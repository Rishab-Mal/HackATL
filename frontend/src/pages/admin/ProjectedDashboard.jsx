import { useEffect, useState } from 'react'
import { AreaChart, Card, Title } from '@tremor/react'
import { getAdminMetrics } from '../../api.js'
import { formatWeightKg } from '../../utils/formatters.js'

const KPIS = [
  { label: 'CO₂ Prevented',       value: '6,300 t', sub: '= removing 1,360 cars for a full year',          bg: '#166534', text: '#fff', accent: '#86efac' },
  { label: 'Water Conserved',      value: '8.1B L',  sub: '= 124 million showers',                          bg: '#1e40af', text: '#fff', accent: '#93c5fd' },
  { label: 'Fabric from Landfill', value: '3,000 t', sub: '= 6.6M lbs kept in active circulation',         bg: '#292524', text: '#fff', accent: '#a8a29e' },
  { label: 'Revenue Unlocked',     value: '$9M / yr', sub: 'At $3/kg avg across the network',               bg: '#92400e', text: '#fff', accent: '#fcd34d' },
]

const SCALE_POINTS = [
  { label: 'Pilot',     sub: null },
  { label: '×1,316',   sub: 'one facility / yr' },
  { label: '×50 fac.', sub: 'full network' },
  { label: '3,000 t',  sub: 'diverted / yr', end: true },
]

const SUMMARY_ITEMS = [
  { label: 'CO₂ prevented', value: '6,300 t' },
  { label: 'Revenue',        value: '$9M' },
  { label: 'Water saved',    value: '8.1B L' },
]

// 5-year revenue ramp: Demo(live) → Q4 2026 → 2027 → 2028 → 2029 → 2030
const REVENUE_RAMP = [
  { year: '2027 · 5 fac',  revenue: 1.0 },
  { year: '2028 · 15 fac', revenue: 3.0 },
  { year: '2029 · 30 fac', revenue: 5.5 },
  { year: '2030 · 50 fac', revenue: 9.0 },
]

export default function ProjectedDashboard() {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    getAdminMetrics().then(setMetrics).catch(() => {})
  }, [])

  const pilotWeight = metrics ? formatWeightKg(metrics.total_weight_kg) : '—'
  const revM = metrics ? parseFloat(((metrics.revenue || 0) / 1_000_000).toFixed(4)) : 0

  const revenueData = [
    { year: 'Live Pilot', revenue: revM },
    { year: '2026 · 1 fac', revenue: 0.18 },
    ...REVENUE_RAMP,
  ]

  return (
    <div className="admin-command">
      {/* ── Subtle context strip ── */}
      <div className="proj-context-strip">
        <span className="proj-context-badge">Carter's Scale Model</span>
        <span>50 facilities · 5,000 kg / fac / month · $3 / kg avg · same CV pipeline</span>
      </div>

      {/* ── KPI strip ── */}
      <div className="dash-kpi-strip">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="dash-kpi-tile" style={{ background: kpi.bg, color: kpi.text }}>
            <div className="dash-kpi-top">
              <span className="dash-kpi-label" style={{ color: kpi.accent }}>{kpi.label}</span>
            </div>
            <strong className="dash-kpi-value">{kpi.value}</strong>
            <span className="dash-kpi-sub" style={{ color: kpi.accent }}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="admin-proj-chart-row">
        <Card className="admin-proj-chart-main">
          <Title>5-year revenue ramp</Title>
          <p className="proj-chart-note">
            Anchored to live pilot · scales linearly through Carter's 50-facility network by 2030
          </p>
          <AreaChart
            className="proj-area-chart"
            data={revenueData}
            index="year"
            categories={['revenue']}
            colors={['emerald']}
            valueFormatter={(v) => `$${v}M`}
            showAnimation
            showLegend={false}
            curveType="monotone"
          />
        </Card>

        <Card className="admin-proj-scale-card">
          <Title>Upscaling logic</Title>
          <p className="proj-chart-note">From this demo to Carter's full network</p>

          <div className="proj-scale-chain">
            <div className="proj-scale-step">
              <strong>Pilot</strong>
              <span>{pilotWeight} scanned</span>
            </div>
            <span className="proj-scale-arrow">→</span>
            <div className="proj-scale-step">
              <strong>×1,316</strong>
              <span>one facility / yr</span>
            </div>
            <span className="proj-scale-arrow">→</span>
            <div className="proj-scale-step">
              <strong>×50 fac.</strong>
              <span>full network</span>
            </div>
            <span className="proj-scale-arrow">→</span>
            <div className="proj-scale-step proj-scale-step--end">
              <strong>3,000 t</strong>
              <span>diverted / yr</span>
            </div>
          </div>

          <div className="proj-summary-grid">
            {SUMMARY_ITEMS.map((item) => (
              <div key={item.label} className="proj-summary-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
