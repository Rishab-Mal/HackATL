import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { deleteLot, delistLot, getAdminMetrics, relistLot } from '../../api.js'
import { formatMoney, formatUnitPrice, formatWeightKg } from '../../utils/formatters.js'

const STATUS_COLORS = {
  Available: '#166534',
  Claimed: '#111111',
  Unlisted: '#b91c1c',
}

const FABRIC_COLORS = ['#166534', '#2563eb', '#7c3aed', '#d97706', '#0f766e', '#b91c1c']

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState({})
  const [tab, setTab] = useState('pilot')

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

      <section className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-eyebrow">Reweave admin command center</span>
          <h1>Turn factory scans into inventory, impact, and action.</h1>
          <div className="admin-tab-bar">
            <button
              className={`admin-tab-btn${tab === 'pilot' ? ' is-active' : ''}`}
              onClick={() => setTab('pilot')}
            >
              <span className="admin-tab-live" />
              Pilot Demo
            </button>
            <button
              className={`admin-tab-btn${tab === 'carters' ? ' is-active' : ''}`}
              onClick={() => setTab('carters')}
            >
              Carter's Scale
            </button>
          </div>
        </div>
        <div className="admin-hero-panel">
          <div className="admin-live-row">Live database</div>
          <div className="admin-hero-number">{metrics.total_lots}</div>
          <div className="admin-hero-label">lots in the system</div>
          <div className="admin-mini-grid">
            <span>{metrics.total_pieces} pieces</span>
            <span>{formatWeightKg(metrics.total_weight_kg)}</span>
            <span>{formatMoney(metrics.inventory_value)} live value</span>
          </div>
        </div>
      </section>

      {tab === 'pilot' && (
        <>
          {!hasData && <EmptyDemoState />}

          <section className="admin-kpi-grid" aria-label="Impact summary">
            <Kpi
              label="CO₂ Prevented"
              value={formatWeightKg(metrics.total_carbon_saved_kg)}
              note={`= ${metrics.carbon_equiv_car_miles.toLocaleString()} miles not driven`}
            />
            <Kpi
              label="Water Conserved"
              value={formatWater(metrics.total_water_saved_l)}
              note={`= ${metrics.water_equiv_showers.toLocaleString()} showers saved`}
            />
            <Kpi
              label="Fabric from Landfill"
              value={formatWeightKg(metrics.total_weight_kg)}
              note={`${metrics.total_pieces} pieces kept in circulation`}
            />
            <Kpi
              label="Revenue Unlocked"
              value={formatMoney(metrics.revenue)}
              note={`${metrics.claim_rate_pct}% sell-through rate`}
            />
          </section>

          {hasData && (
            <section className="admin-section admin-pilot-charts">
              <div className="admin-pilot-chart-grid">
                <ChartCard title="Fabric diverted by material type">
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={fabricRows} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="#eeeeee" vertical={false} />
                      <XAxis dataKey="fabric_type" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `${(v * 1000).toFixed(0)}g`} />
                      <Tooltip formatter={(value) => formatWeightKg(Number(value))} labelStyle={{ color: '#111' }} />
                      <Bar dataKey="weight_kg" radius={[4, 4, 0, 0]}>
                        {fabricRows.map((_, i) => <Cell key={i} fill={FABRIC_COLORS[i % FABRIC_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Lot status breakdown">
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={statusMix} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>
                        {statusMix.map((entry) => <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="admin-status-legend">
                    {statusMix.map((entry) => (
                      <span key={entry.name}><i style={{ background: STATUS_COLORS[entry.name] }} />{entry.name}: {entry.value}</span>
                    ))}
                  </div>
                </ChartCard>

                <ChartCard title="Weight per scan run">
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart data={runHistory} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="runWeightTab" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#166534" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#166534" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#eeeeee" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `${v}g`} />
                      <Tooltip formatter={(value) => [`${value} g`, 'Weight']} />
                      <Area type="monotone" dataKey="weight_g" stroke="#166534" fill="url(#runWeightTab)" strokeWidth={2} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </section>
          )}

          <div className="admin-equiv-band">
            <EquivItem value={metrics.carbon_equiv_car_miles.toLocaleString()} label="car miles avoided" />
            <EquivItem value={metrics.water_equiv_showers.toLocaleString()} label="showers worth of water saved" />
            <EquivItem value={metrics.water_equiv_bottles.toLocaleString()} label="water bottles conserved" />
            <EquivItem value={metrics.carbon_equiv_phones.toLocaleString()} label="phone charges of CO₂ prevented" />
          </div>
        </>
      )}

      {tab === 'carters' && <CartersTab metrics={metrics} />}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Kpi({ label, value, note }) {
  return (
    <article className="admin-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}

function ChartCard({ title, children }) {
  return (
    <article className="admin-chart-card">
      <h3>{title}</h3>
      {children}
    </article>
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

// ── Carter's Scale tab ────────────────────────────────────────────────────────

function CartersKpi({ label, value, note }) {
  return (
    <div className="admin-carters-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}

function CartersTab({ metrics }) {
  const revM = parseFloat(((metrics.revenue || 0) / 1_000_000).toFixed(4))
  const revenueData = [
    { name: 'Demo (Live)', value: revM },
    { name: 'Yr 1 · 5 fac.', value: 1.2 },
    { name: 'Yr 2 · 25 fac.', value: 5.5 },
    { name: 'Yr 3 · 50 fac.', value: 9.0 },
  ]

  return (
    <div className="admin-carters-tab">
      <div className="admin-carters-note">
        Projection: 50 Carter's facilities × 5,000 kg scrap/month × 12 months = <strong>3,000 tonnes diverted/year</strong>.
        Same platform. Same CV pipeline. Same buyer network.
      </div>

      <div className="admin-carters-kpi-grid">
        <CartersKpi label="CO₂ Prevented" value="6,300 t" note="= removing 1,360 cars from the road for a year" />
        <CartersKpi label="Water Conserved" value="8.1B L" note="= 124 million showers saved" />
        <CartersKpi label="Fabric from Landfill" value="3,000 t" note="= 6.6M lbs kept in circulation" />
        <CartersKpi label="Revenue Unlocked" value="$9M" note="at $3 / kg average lot price" />
      </div>

      <div className="admin-carters-body">
        <div className="admin-carters-chart-card">
          <h3>Revenue ramp — projected rollout</h3>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={revenueData} margin={{ top: 6, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1a3324" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: '#86efac' }} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} tick={{ fill: '#86efac' }} tickFormatter={(v) => `$${v}M`} />
              <Tooltip
                formatter={(v) => [`$${v}M`, 'Revenue']}
                contentStyle={{ background: '#052e16', border: '1px solid #166534', color: '#86efac', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#4ade80"
                fill="url(#revenueGrad)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#4ade80', stroke: '#052e16', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="admin-carters-scale-card">
          <h3>Upscaling logic</h3>
          <div className="admin-scale-chain">
            <div className="admin-scale-step">
              <strong>Pilot</strong>
              <span>{formatWeightKg(metrics.total_weight_kg)} scanned</span>
            </div>
            <div className="admin-scale-arrow">→</div>
            <div className="admin-scale-step">
              <strong>×1,316</strong>
              <span>one facility / yr</span>
            </div>
            <div className="admin-scale-arrow">→</div>
            <div className="admin-scale-step">
              <strong>×50 fac.</strong>
              <span>Carter's network</span>
            </div>
            <div className="admin-scale-arrow">→</div>
            <div className="admin-scale-step admin-scale-step--end">
              <strong>3,000 t</strong>
              <span>diverted / year</span>
            </div>
          </div>
          <div className="admin-scale-summary">
            <span>6,300 t CO₂ prevented</span>
            <span>$9M revenue unlocked</span>
            <span>8.1B L water saved</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyDemoState() {
  return (
    <section className="admin-empty-state">
      <IconScan />
      <div>
        <strong>No scans yet — ready for a live demo.</strong>
        <span>
          Head to the factory portal, photograph a fabric table, and this dashboard will fill
          with scan evidence, lot controls, CO₂ impact, and buyer analytics within seconds.
          One photo is all it takes to show Carter's pilot in action.
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
