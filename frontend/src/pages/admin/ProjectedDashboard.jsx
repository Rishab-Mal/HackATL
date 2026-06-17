import { useEffect, useState } from 'react'
import { AreaChart, Card, Flex, Metric, Text, Title } from '@tremor/react'
import { getAdminMetrics } from '../../api.js'
import { formatWeightKg } from '../../utils/formatters.js'

const KPIS = [
  { label: 'CO₂ Prevented',       value: '6,300 t', note: 'Removing 1,360 cars from the road for a full year', color: 'emerald' },
  { label: 'Water Conserved',      value: '8.1B L',  note: 'Enough for 124 million showers',                   color: 'blue' },
  { label: 'Fabric from Landfill', value: '3,000 t', note: '6.6 million pounds kept in active circulation',     color: 'emerald' },
  { label: 'Revenue Unlocked',     value: '$9M',     note: 'At $3 per kg average lot price across the network', color: 'emerald' },
]

const BASE_REVENUE = [
  { name: 'Yr 1 · 5 fac.', value: 1.2 },
  { name: 'Yr 2 · 25 fac.', value: 5.5 },
  { name: 'Yr 3 · 50 fac.', value: 9.0 },
]

const SCALE_STEPS = [
  { label: 'Pilot', subLabel: null },            // filled dynamically
  { label: '×1,316', subLabel: 'one facility / yr' },
  { label: '×50 fac.', subLabel: 'full network' },
  { label: '3,000 t', subLabel: 'diverted / yr', end: true },
]

const SUMMARY_ITEMS = [
  { label: 'CO₂ prevented', value: '6,300 t' },
  { label: 'Revenue',        value: '$9M' },
  { label: 'Water saved',    value: '8.1B L' },
]

export default function ProjectedDashboard() {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    getAdminMetrics().then(setMetrics).catch(() => {})
  }, [])

  const pilotWeight = metrics ? formatWeightKg(metrics.total_weight_kg) : '—'
  const revM = metrics ? parseFloat(((metrics.revenue || 0) / 1_000_000).toFixed(4)) : 0
  const revenueData = [{ name: 'Demo (Live)', value: revM }, ...BASE_REVENUE]

  return (
    <div className="admin-command">
      {/* ── Hero (light card, no black) ── */}
      <section className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-eyebrow">Reweave · Carter's Network Projection</span>
          <h1>What Reweave looks like at Carter's scale.</h1>
        </div>
        <Card decoration="left" decorationColor="emerald" className="admin-hero-stats-card">
          <Flex alignItems="start" justifyContent="between">
            <div>
              <Text>Carter's contract facilities</Text>
              <Metric>50</Metric>
            </div>
            <div className="admin-hero-chips">
              <span>5,000 kg / fac / mo</span>
              <span>3,000 t / year</span>
              <span>$9M revenue</span>
            </div>
          </Flex>
        </Card>
      </section>

      <div className="admin-tremor-section">
        {/* ── KPI cards ── */}
        <div className="admin-proj-kpi-grid">
          {KPIS.map((kpi) => (
            <Card key={kpi.label} decoration="top" decorationColor={kpi.color}>
              <Text>{kpi.label}</Text>
              <Metric className="proj-metric">{kpi.value}</Metric>
              <Text className="proj-note">{kpi.note}</Text>
            </Card>
          ))}
        </div>

        {/* ── Charts ── */}
        <div className="admin-proj-chart-row">
          <Card className="admin-proj-chart-main">
            <Title>Revenue ramp — projected rollout</Title>
            <Text className="proj-note">
              Live pilot anchors the chart · scales through 5, 25, and 50 Carter's facilities.
            </Text>
            <AreaChart
              className="proj-area-chart"
              data={revenueData}
              index="name"
              categories={['value']}
              colors={['emerald']}
              valueFormatter={(v) => `$${v}M`}
              showAnimation
              showLegend={false}
            />
          </Card>

          <Card className="admin-proj-scale-card">
            <Title>Upscaling logic</Title>
            <Text className="proj-note">From this demo to Carter's full network</Text>

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
    </div>
  )
}
