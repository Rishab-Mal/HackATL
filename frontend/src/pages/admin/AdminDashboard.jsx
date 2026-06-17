import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart,
  BarChart,
  Card,
  DonutChart,
  Flex,
  Metric,
  Text,
  Title,
} from '@tremor/react'
import { deleteLot, delistLot, getAdminMetrics, relistLot } from '../../api.js'
import { formatMoney, formatUnitPrice, formatWeightKg } from '../../utils/formatters.js'

const DONUT_COLORS = ['emerald', 'neutral', 'rose']

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState({})

  function refresh() {
    getAdminMetrics()
      .then((data) => { setMetrics(data); setError(null) })
      .catch((err) => setError(err.message))
  }

  useEffect(refresh, [])

  async function runLotAction(lot, action) {
    const key = `${action}-${lot.id}`
    if (action === 'delete' && !window.confirm(`Delete ${lot.name}? This removes it from inventory and analytics.`)) return
    setActing((prev) => ({ ...prev, [key]: true }))
    try {
      if (action === 'delist') await delistLot(lot.id)
      if (action === 'relist') await relistLot(lot.id)
      if (action === 'delete') await deleteLot(lot.id)
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setActing((prev) => ({ ...prev, [key]: false }))
    }
  }

  if (error && !metrics) return <div className="error">{error}</div>
  if (!metrics) return <div className="dash-loading"><div className="dash-spinner" />Loading admin dashboard...</div>

  const runHistory = metrics.run_history || []
  const fabricRows = metrics.fabric_stats || []
  const statusMix = (metrics.status_mix || []).filter((item) => item.value > 0)
  const hasData = metrics.has_data

  return (
    <div className="admin-command">
      {error && <div className="error">{error}</div>}

      {/* ── Hero ── */}
      <section className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-eyebrow">Reweave · Live database</span>
          <h1>Inventory, impact, and action.</h1>
        </div>
        <Card decoration="left" decorationColor="emerald" className="admin-hero-stats-card">
          <Flex alignItems="start" justifyContent="between">
            <div>
              <Text>Lots in system</Text>
              <Metric>{metrics.total_lots}</Metric>
            </div>
            <div className="admin-hero-chips">
              <span>{metrics.total_pieces} pieces</span>
              <span>{formatWeightKg(metrics.total_weight_kg)}</span>
              <span>{formatMoney(metrics.inventory_value)} live value</span>
            </div>
          </Flex>
        </Card>
      </section>

      {!hasData && <EmptyDemoState />}

      {/* ── KPI cards ── */}
      <div className="admin-tremor-section">
        <div className="admin-proj-kpi-grid">
          <Card decoration="top" decorationColor="emerald">
            <Text>CO₂ Prevented</Text>
            <Metric className="proj-metric">{formatWeightKg(metrics.total_carbon_saved_kg)}</Metric>
            <Text className="proj-note">= {metrics.carbon_equiv_car_miles.toLocaleString()} miles not driven</Text>
          </Card>
          <Card decoration="top" decorationColor="blue">
            <Text>Water Conserved</Text>
            <Metric className="proj-metric">{formatWater(metrics.total_water_saved_l)}</Metric>
            <Text className="proj-note">= {metrics.water_equiv_showers.toLocaleString()} showers saved</Text>
          </Card>
          <Card decoration="top" decorationColor="emerald">
            <Text>Fabric from Landfill</Text>
            <Metric className="proj-metric">{formatWeightKg(metrics.total_weight_kg)}</Metric>
            <Text className="proj-note">{metrics.total_pieces} pieces kept in circulation</Text>
          </Card>
          <Card decoration="top" decorationColor="emerald">
            <Text>Revenue Unlocked</Text>
            <Metric className="proj-metric">{formatMoney(metrics.revenue)}</Metric>
            <Text className="proj-note">{metrics.claim_rate_pct}% sell-through rate</Text>
          </Card>
        </div>

        {/* ── Charts ── */}
        {hasData && (
          <div className="admin-pilot-chart-grid">
            <Card>
              <Title>Fabric diverted by material type</Title>
              <BarChart
                className="h-44 mt-2"
                data={fabricRows}
                index="fabric_type"
                categories={['weight_kg']}
                colors={['emerald']}
                valueFormatter={(v) => formatWeightKg(v)}
                showLegend={false}
              />
            </Card>
            <Card>
              <Title>Lot status</Title>
              <DonutChart
                className="h-44 mt-2"
                data={statusMix}
                index="name"
                category="value"
                colors={DONUT_COLORS}
                label={`${metrics.total_lots} lots`}
              />
            </Card>
            <Card>
              <Title>Weight per scan run</Title>
              <AreaChart
                className="h-44 mt-2"
                data={runHistory}
                index="name"
                categories={['weight_g']}
                colors={['emerald']}
                valueFormatter={(v) => `${v}g`}
                showLegend={false}
              />
            </Card>
          </div>
        )}

        {/* ── Equivalents ── */}
        <div className="admin-equiv-band">
          <EquivItem value={metrics.carbon_equiv_car_miles.toLocaleString()} label="car miles avoided" />
          <EquivItem value={metrics.water_equiv_showers.toLocaleString()} label="showers saved" />
          <EquivItem value={metrics.water_equiv_bottles.toLocaleString()} label="water bottles conserved" />
          <EquivItem value={metrics.carbon_equiv_phones.toLocaleString()} label="phone charges of CO₂" />
        </div>
      </div>
    </div>
  )
}

function EquivItem({ value, label }) {
  return (
    <div className="admin-equiv-item">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function EmptyDemoState() {
  return (
    <section className="admin-empty-state">
      <IconScan />
      <div>
        <strong>No scans yet — ready for a live demo.</strong>
        <span>
          Head to the factory portal, photograph a fabric table, and this dashboard will fill
          with scan evidence, lot controls, CO₂ impact, and buyer analytics within seconds.
        </span>
      </div>
      <Link to="/factory" className="admin-empty-cta">Run first scan →</Link>
    </section>
  )
}

function IconScan() {
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7" />
      <path d="M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7" />
      <path d="M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17" />
      <path d="M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17" />
      <path d="M7 12h10" />
      <path d="M8 9h3" />
      <path d="M13 15h3" />
    </svg>
  )
}

function LotActionRow({ lot, acting, onAction }) {
  const publishKey = `${lot.status === 'unlisted' ? 'relist' : 'delist'}-${lot.id}`
  const deleteKey = `delete-${lot.id}`
  return (
    <article className="admin-lot-action-row">
      <div className="admin-lot-thumb" style={{ background: lot.color_hex }}>
        {lot.thumbnail && <img src={lot.thumbnail} alt="" />}
      </div>
      <div className="admin-lot-action-main">
        <strong>{lot.name}</strong>
        <span>{lot.fabric_type} · {formatWeightKg(lot.weight_kg)} · {formatUnitPrice(lot.weight_kg > 0 ? lot.current_price_usd / lot.weight_kg : 0)}</span>
      </div>
      <span className={`admin-status admin-status--${lot.status}`}>{lot.status}</span>
      <div className="admin-row-buttons">
        {lot.status === 'unlisted' ? (
          <button type="button" onClick={() => onAction(lot, 'relist')} disabled={acting[publishKey]}>Publish</button>
        ) : lot.status === 'available' ? (
          <button type="button" className="btn-ghost" onClick={() => onAction(lot, 'delist')} disabled={acting[publishKey]}>Delist</button>
        ) : null}
        <button type="button" className="btn-ghost admin-danger-btn" onClick={() => onAction(lot, 'delete')} disabled={acting[deleteKey]}>Delete</button>
      </div>
    </article>
  )
}

function formatWater(value) {
  const liters = Number(value) || 0
  if (liters <= 0) return '0 L'
  if (liters < 10) return `${liters.toFixed(1)} L`
  if (liters < 1000) return `${Math.round(liters).toLocaleString()} L`
  return `${(liters / 1000).toFixed(liters >= 10000 ? 0 : 1)} kL`
}
