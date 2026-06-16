import { useEffect, useState } from 'react'
import {
  Card, Grid, Flex, Col,
  Metric, Text, Title, Bold,
  Badge, BadgeDelta,
  AreaChart, BarList,
  ProgressBar,
  List, ListItem,
  Divider,
} from '@tremor/react'

const valueKg = v => `${v} kg`

export default function Dashboard() {
  const [m, setM] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('scrap_token')
    fetch('/api/admin/metrics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setM)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="error">{error}</div>
  if (!m) return <div className="dash-loading"><div className="dash-spinner" />Loading impact data…</div>

  const impactTrendData = m.impact_trend.map(d => ({
    date: d.date,
    'CO₂ Saved (kg)': d.carbon_kg,
  }))

  const fabricImpactData = m.fabric_impact.map(f => ({
    name: f.fabric,
    value: f.carbon_kg,
  }))

  const equivCards = [
    { value: m.carbon_equiv_trees,               label: 'Trees absorbing CO₂ for a full year' },
    { value: m.carbon_equiv_car_miles.toLocaleString(), label: 'Miles of driving avoided' },
    { value: m.carbon_equiv_flights,              label: 'Domestic flights offset' },
    { value: m.carbon_equiv_phones.toLocaleString(), label: 'Phone charges powered' },
    { value: m.water_equiv_showers.toLocaleString(), label: '8-minute showers saved' },
    { value: m.water_equiv_bathtubs.toLocaleString(), label: 'Bathtubs of water conserved' },
    { value: m.water_equiv_bottles.toLocaleString(), label: '500 mL bottles not consumed' },
    { value: m.energy_equiv_homes,               label: 'Homes powered for a year' },
  ]

  return (
    <div className="dash">

      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Environmental Impact</h1>
          <p className="dash-subtitle">fibr · Carter's Make &amp; Remake Pilot · Atlanta, GA</p>
        </div>
        <div className="sdg-badges">
          <div className="sdg-badge sdg-12">SDG 12<br /><span>Responsible Consumption</span></div>
          <div className="sdg-badge sdg-6">SDG 6<br /><span>Clean Water</span></div>
          <div className="sdg-badge sdg-13">SDG 13<br /><span>Climate Action</span></div>
        </div>
      </div>

      {/* ── Mission + Diversion Progress ── */}
      <Card className="mb-4">
        <Flex alignItems="start" className="gap-8 flex-wrap">
          <div className="flex-1 min-w-0">
            <Text className="text-green-700 font-semibold uppercase text-xs tracking-widest mb-1">Our Mission</Text>
            <Text>
              Every kilogram of fabric diverted from landfill prevents raw-material extraction,
              toxic dye processing, and methane emissions from decomposition. fibr turns
              factory waste into a circular supply chain.
            </Text>
          </div>
          <div className="min-w-48">
            <Metric>{m.diversion_pct}%</Metric>
            <Text className="mt-1">of {m.diversion_target_kg} kg pilot goal reached</Text>
            <ProgressBar value={m.diversion_pct} color="green" className="mt-3" />
            <Flex className="mt-1">
              <Text className="text-xs"><Bold>{m.total_weight_kg} kg</Bold> diverted</Text>
              <Text className="text-xs">{Math.max(0, m.diversion_target_kg - m.total_weight_kg).toFixed(1)} kg to go</Text>
            </Flex>
          </div>
        </Flex>
      </Card>

      {/* ── Hero metrics ── */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-3 mb-4">
        <Card decoration="top" decorationColor="green">
          <Text>CO₂ Emissions Prevented</Text>
          <Metric className="mt-1">{m.total_carbon_saved_kg} kg</Metric>
          <BadgeDelta deltaType="increase" size="xs" className="mt-2">Diverted</BadgeDelta>
        </Card>
        <Card decoration="top" decorationColor="blue">
          <Text>Water Conserved</Text>
          <Metric className="mt-1">{m.total_water_saved_l.toLocaleString()} L</Metric>
          <BadgeDelta deltaType="increase" size="xs" className="mt-2">Saved</BadgeDelta>
        </Card>
        <Card decoration="top" decorationColor="violet">
          <Text>Fabric Diverted from Landfill</Text>
          <Metric className="mt-1">{m.total_weight_kg} kg</Metric>
          <BadgeDelta deltaType="increase" size="xs" className="mt-2">From landfill</BadgeDelta>
        </Card>
        <Card decoration="top" decorationColor="orange">
          <Text>Energy Saved</Text>
          <Metric className="mt-1">{m.energy_saved_kwh.toLocaleString()} kWh</Metric>
          <BadgeDelta deltaType="increase" size="xs" className="mt-2">Conserved</BadgeDelta>
        </Card>
      </Grid>

      {/* ── Equivalency cards ── */}
      <Text className="text-green-700 font-semibold uppercase text-xs tracking-widest mb-3">
        What that actually means
      </Text>
      <Grid numItemsSm={2} numItemsLg={4} className="gap-3 mb-5">
        {equivCards.map((item, i) => (
          <Card key={i}>
            <Metric>{item.value}</Metric>
            <Text className="mt-1">{item.label}</Text>
          </Card>
        ))}
      </Grid>

      {/* ── CO₂ trend chart ── */}
      <Card className="mb-3">
        <Title>Cumulative CO₂ Saved — Last 30 Days</Title>
        <AreaChart
          className="mt-4 h-48"
          data={impactTrendData}
          index="date"
          categories={['CO₂ Saved (kg)']}
          colors={['green']}
          valueFormatter={valueKg}
          showLegend={false}
          showGridLines={true}
        />
      </Card>

      {/* ── CO₂ by fabric — Tremor BarList ── */}
      <Card className="mb-4">
        <Title>CO₂ Saved by Fabric Type</Title>
        <BarList
          data={fabricImpactData}
          className="mt-4"
          color="green"
          valueFormatter={valueKg}
        />
      </Card>

      {/* ── Carter's contribution ── */}
      <div className="carters-card mb-4">
        <div className="carters-card-header">
          <div>
            <div className="carters-card-eyebrow">Supplier Pilot Contribution</div>
            <div className="carters-card-title">Carter's Circular Supply</div>
          </div>
          <div className="carters-card-badge">LIVE PILOT</div>
        </div>
        <div className="carters-card-stats">
          <div className="carters-stat">
            <div className="carters-stat-value">{m.carters_lots}</div>
            <div className="carters-stat-label">Lots Claimed</div>
          </div>
          <div className="carters-stat">
            <div className="carters-stat-value">{m.carters_weight_kg} kg</div>
            <div className="carters-stat-label">Fabric Diverted</div>
          </div>
          <div className="carters-stat">
            <div className="carters-stat-value">{m.carters_carbon_kg} kg</div>
            <div className="carters-stat-label">CO₂ Saved</div>
          </div>
          <div className="carters-stat">
            <div className="carters-stat-value">${m.carters_revenue.toFixed(0)}</div>
            <div className="carters-stat-label">Revenue to Supplier</div>
          </div>
        </div>
        <div className="carters-card-footer">
          Carter's Atlanta supplier offcuts → sorted by fibr CV pipeline → claimed by Looptex Recyclers
        </div>
      </div>

      {/* ── Fabric breakdown — Tremor List ── */}
      <Card className="mb-8">
        <Title>Fabric-Level Breakdown</Title>
        <List className="mt-4">
          {m.fabric_stats.map(r => (
            <ListItem key={r.fabric_type}>
              <Flex>
                <div>
                  <Text><Bold>{r.fabric_type}</Bold></Text>
                  <Text className="text-xs">{r.lots} lots · {r.weight_kg} kg</Text>
                </div>
                <div className="text-right">
                  <Text><Bold>{(r.weight_kg * 2.1).toFixed(1)} kg CO₂</Bold></Text>
                  <Text className="text-xs">{(r.weight_kg * 2700).toLocaleString()} L water</Text>
                </div>
              </Flex>
            </ListItem>
          ))}
        </List>
      </Card>

    </div>
  )
}
