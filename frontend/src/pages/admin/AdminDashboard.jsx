import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, BarChart, Card, DonutChart, Title } from '@tremor/react'
import { deleteLot, delistLot, getAdminMetrics, relistLot } from '../../api.js'
import { formatMoney, formatWeightKg } from '../../utils/formatters.js'

const DONUT_COLORS = ['emerald', 'neutral', 'rose']

const KPI_CONFIG = [
  {
    key: 'co2',
    label: 'CO₂ Prevented',
    bg: '#166534', text: '#fff', sub: '#86efac',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 0-7.35 16.83" /><path d="M12 2a10 10 0 0 1 7.35 16.83" /><path d="M8 16s1-1 4-1 4 1 4 1" /><path d="M12 12v4" /></svg>,
  },
  {
    key: 'water',
    label: 'Water Conserved',
    bg: '#1e40af', text: '#fff', sub: '#93c5fd',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>,
  },
  {
    key: 'fabric',
    label: 'Fabric from Landfill',
    bg: '#292524', text: '#fff', sub: '#a8a29e',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>,
  },
  {
    key: 'revenue',
    label: 'Revenue Unlocked',
    bg: '#92400e', text: '#fff', sub: '#fcd34d',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  },
]

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(null)

  function refresh() {
    getAdminMetrics()
      .then((data) => { setMetrics(data); setError(null) })
      .catch((err) => setError(err.message))
  }

  useEffect(refresh, [])

  if (error && !metrics) return <div className="error">{error}</div>
  if (!metrics) return <div className="dash-loading"><div className="dash-spinner" />Loading dashboard...</div>

  const runHistory = metrics.run_history || []
  const fabricRows = metrics.fabric_stats || []
  const statusMix = (metrics.status_mix || []).filter((item) => item.value > 0)
  const hasData = metrics.has_data

  const kpiValues = {
    co2:     { value: formatWeightKg(metrics.total_carbon_saved_kg), sub: `${metrics.carbon_equiv_car_miles.toLocaleString()} miles not driven` },
    water:   { value: formatWater(metrics.total_water_saved_l),       sub: `${metrics.water_equiv_showers.toLocaleString()} showers saved` },
    fabric:  { value: formatWeightKg(metrics.total_weight_kg),        sub: `${metrics.total_pieces} pieces kept in circulation` },
    revenue: { value: formatMoney(metrics.revenue),                   sub: `${metrics.claim_rate_pct}% sell-through rate` },
  }

  return (
    <div className="admin-command">
      {error && <div className="error">{error}</div>}

      {/* ── KPI strip ── */}
      <div className="dash-kpi-strip">
        {KPI_CONFIG.map((cfg) => {
          const { value, sub } = kpiValues[cfg.key]
          return (
            <div key={cfg.key} className="dash-kpi-tile" style={{ background: cfg.bg, color: cfg.text }}>
              <div className="dash-kpi-top">
                <span className="dash-kpi-label" style={{ color: cfg.sub }}>{cfg.label}</span>
                <span className="dash-kpi-icon" style={{ color: cfg.sub }}>{cfg.icon}</span>
              </div>
              <strong className="dash-kpi-value">{value}</strong>
              <span className="dash-kpi-sub" style={{ color: cfg.sub }}>{sub}</span>
            </div>
          )
        })}
      </div>

      {!hasData && <EmptyDemoState />}

      {/* ── Charts ── */}
      {hasData && (
        <div className="admin-pilot-chart-grid">
          <Card>
            <Title>Fabric by material type</Title>
            <BarChart
              className="h-48 mt-3"
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
              className="h-48 mt-3"
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
              className="h-48 mt-3"
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

      {/* ── Equivalents band ── */}
      <div className="admin-equiv-band">
        <EquivItem value={metrics.carbon_equiv_car_miles.toLocaleString()} label="car miles avoided" />
        <EquivItem value={metrics.water_equiv_showers.toLocaleString()} label="showers saved" />
        <EquivItem value={metrics.water_equiv_bottles.toLocaleString()} label="water bottles conserved" />
        <EquivItem value={metrics.carbon_equiv_phones.toLocaleString()} label="phone charges of CO₂" />
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
          with real CO₂ impact, lot controls, and buyer analytics within seconds.
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
      <path d="M7 12h10" /><path d="M8 9h3" /><path d="M13 15h3" />
    </svg>
  )
}

function formatWater(value) {
  const liters = Number(value) || 0
  if (liters <= 0) return '0 L'
  if (liters < 1000) return `${Math.round(liters).toLocaleString()} L`
  return `${(liters / 1000).toFixed(liters >= 10000 ? 0 : 1)} kL`
}
