import { useEffect, useState } from 'react'
import {
  Card, Grid, Flex, Col,
  Metric, Text, Title, Subtitle, Bold,
  Badge, BadgeDelta,
  AreaChart, BarChart, DonutChart,
  ProgressBar, BarList,
  List, ListItem,
  Divider,
} from '@tremor/react'
import { formatMoney, formatWeightKg } from '../../utils/formatters.js'

const valueUSD = v => formatMoney(v)
const valueKg = v => formatWeightKg(v)

function SectionHeader({ title, badge }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {badge && <span className="section-badge">{badge}</span>}
    </div>
  )
}

export default function AdminDashboard() {
  const [m, setM] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('reweave_token')
    fetch('/api/admin/metrics', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setM)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="error">{error}</div>
  if (!m) return <div className="dash-loading"><div className="dash-spinner" />Loading dashboard…</div>

  // ── Chart data ─────────────────────────────────────
  const revenueData = m.revenue_trend.map(d => ({
    date: d.date,
    Revenue: d.revenue,
  }))

  const fabricBarData = m.fabric_stats.slice(0, 8).map(f => ({
    name: f.fabric_type.replace(/\/.*/, '').replace(' Blend', '').trim(),
    Revenue: f.revenue,
  }))

  const sellThroughData = [
    { name: 'Sold', value: m.claimed_lots },
    { name: 'Available', value: m.available_lots },
  ]

  const impactTrendData = m.impact_trend.map(d => ({
    date: d.date,
    'CO₂ Saved (kg)': d.carbon_kg,
  }))

  const fabricImpactData = m.fabric_impact.map(f => ({
    name: f.fabric,
    'CO₂ (kg)': f.carbon_kg,
  }))

  const topBuyersData = m.top_buyers.map(b => ({
    name: b.name,
    value: b.value,
  }))

  return (
    <div className="dash">
      {/* ── Page header ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Operations Dashboard</h1>
          <p className="dash-subtitle">Reweave · Carter's Make &amp; Remake Pilot</p>
        </div>
        <Badge color="green" size="sm">Live</Badge>
      </div>

      {/* ── Diversion Progress — Tremor ProgressBar ── */}
      <Card className="mb-4">
        <Flex alignItems="start">
          <div>
            <Text>Fabric Waste Diverted from Landfill</Text>
            <Metric className="mt-1">{formatWeightKg(m.total_weight_kg)}</Metric>
          </div>
          <BadgeDelta deltaType="increase" size="sm">
            {m.diversion_pct}% of goal
          </BadgeDelta>
        </Flex>
        <ProgressBar value={m.diversion_pct} color="green" className="mt-3" />
        <Flex className="mt-2">
          <Text><Bold>{m.diversion_pct}% complete</Bold></Text>
          <Text>{formatWeightKg(Math.max(0, m.diversion_target_kg - m.total_weight_kg))} to {formatWeightKg(m.diversion_target_kg)} goal</Text>
        </Flex>
      </Card>

      {/* ── Carter's Pilot ── */}
      <div className="carters-card">
        <div className="carters-card-header">
          <div>
            <div className="carters-card-eyebrow">Supplier Pilot</div>
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
            <div className="carters-stat-value">{formatWeightKg(m.carters_weight_kg)}</div>
            <div className="carters-stat-label">Fabric Diverted</div>
          </div>
          <div className="carters-stat">
            <div className="carters-stat-value">{formatMoney(m.carters_revenue)}</div>
            <div className="carters-stat-label">Revenue Generated</div>
          </div>
          <div className="carters-stat">
            <div className="carters-stat-value">{m.carters_carbon_kg} kg</div>
            <div className="carters-stat-label">CO₂ Saved</div>
          </div>
        </div>
        <div className="carters-card-footer">
          Offcuts from Carter's Atlanta supplier → sorted by Reweave → claimed by recyclers
        </div>
      </div>

      {/* ── Revenue & Inventory — Tremor Cards + BadgeDelta ── */}
      <SectionHeader title="Revenue & Inventory" />
      <Grid numItemsSm={2} numItemsLg={4} className="gap-3 mb-4">
        <Card>
          <Text>Total Revenue</Text>
          <Metric className="mt-1">{valueUSD(m.revenue)}</Metric>
          <Flex className="mt-2">
            <Text className="text-xs text-gray-500">From claimed lots</Text>
            <BadgeDelta deltaType="increase" size="xs">Live</BadgeDelta>
          </Flex>
        </Card>
        <Card>
          <Text>Gross Profit</Text>
          <Metric className="mt-1">{valueUSD(m.gross_profit)}</Metric>
          <Flex className="mt-2">
            <Text className="text-xs text-gray-500">{m.profit_margin_pct}% margin</Text>
            <BadgeDelta deltaType="increase" size="xs">+{m.profit_margin_pct}%</BadgeDelta>
          </Flex>
        </Card>
        <Card>
          <Text>Inventory Value</Text>
          <Metric className="mt-1">{valueUSD(m.inventory_value)}</Metric>
          <Text className="mt-2 text-xs text-gray-500">After price decay</Text>
        </Card>
        <Card>
          <Text>Est. Cost</Text>
          <Metric className="mt-1">{valueUSD(m.estimated_cost)}</Metric>
          <Text className="mt-2 text-xs text-gray-500">28% of revenue</Text>
        </Card>
      </Grid>

      {/* ── Lot Performance — Tremor Cards ── */}
      <SectionHeader title="Lot Performance" />
      <Grid numItemsSm={3} numItemsLg={6} className="gap-3 mb-5">
        <Card>
          <Text>Total Lots</Text>
          <Metric className="mt-1">{m.total_lots}</Metric>
        </Card>
        <Card>
          <Text>Lots Sold</Text>
          <Metric className="mt-1">{m.claimed_lots}</Metric>
          <Badge color="green" size="xs" className="mt-2">Claimed</Badge>
        </Card>
        <Card>
          <Text>In Inventory</Text>
          <Metric className="mt-1">{m.available_lots}</Metric>
          <Badge color="slate" size="xs" className="mt-2">Available</Badge>
        </Card>
        <Card>
          <Text>Sell-Through</Text>
          <Metric className="mt-1">{m.claim_rate_pct}%</Metric>
          <BadgeDelta
            deltaType={m.claim_rate_pct > 50 ? 'increase' : 'moderateIncrease'}
            size="xs" className="mt-2"
          >
            {m.claim_rate_pct > 50 ? 'On track' : 'Growing'}
          </BadgeDelta>
        </Card>
        <Card>
          <Text>Avg Days to Sell</Text>
          <Metric className="mt-1">{m.avg_days_to_claim}d</Metric>
        </Card>
        <Card>
          <Text>Total Fabric</Text>
          <Metric className="mt-1">{formatWeightKg(m.total_weight_kg)}</Metric>
        </Card>
      </Grid>

      {/* ── Charts row ── */}
      <Grid numItemsLg={3} className="gap-3 mb-4">
        {/* Revenue Trend — Tremor AreaChart */}
        <Col numColSpanLg={2}>
          <Card>
            <Title>Revenue Trend — Last 14 Days</Title>
            <AreaChart
              className="mt-4 h-48"
              data={revenueData}
              index="date"
              categories={['Revenue']}
              colors={['green']}
              valueFormatter={valueUSD}
              showLegend={false}
              showGridLines={true}
            />
          </Card>
        </Col>

        {/* Sell-Through — Tremor DonutChart */}
        <Card>
          <Title>Sell-Through Rate</Title>
          <DonutChart
            className="mt-4 h-48"
            data={sellThroughData}
            category="value"
            index="name"
            colors={['green', 'slate']}
            label={`${m.claim_rate_pct}%`}
          />
          <Flex className="mt-3 justify-center gap-4">
            <Flex className="gap-1.5 items-center">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              <Text className="text-xs">Sold ({m.claimed_lots})</Text>
            </Flex>
            <Flex className="gap-1.5 items-center">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300" />
              <Text className="text-xs">Available ({m.available_lots})</Text>
            </Flex>
          </Flex>
        </Card>
      </Grid>

      {/* Revenue by Fabric — Tremor BarChart */}
      <Card className="mb-4">
        <Title>Revenue by Fabric Type</Title>
        <BarChart
          className="mt-4 h-52"
          data={fabricBarData}
          index="name"
          categories={['Revenue']}
          colors={['green']}
          valueFormatter={valueUSD}
          showLegend={false}
          showGridLines={true}
        />
      </Card>

      {/* ── Bottom panels ── */}
      <Grid numItemsLg={2} className="gap-3 mb-4">
        {/* Recent Sales — Tremor List */}
        <Card>
          <Flex>
            <Title>Recent Sales</Title>
            <Badge color="slate" size="sm">{m.activity_feed.length} latest</Badge>
          </Flex>
          <List className="mt-3">
            {m.activity_feed.map((a, i) => (
              <ListItem key={i}>
                <Flex>
                  <div>
                    <Text><Bold>{a.lot_name}</Bold></Text>
                    <Text className="text-xs">{a.buyer} · {formatWeightKg(a.weight_kg)}</Text>
                  </div>
                  <div className="text-right">
                    <Text><Bold>{valueUSD(a.price)}</Bold></Text>
                    <Text className="text-xs text-gray-400">{a.days_ago}d ago</Text>
                  </div>
                </Flex>
              </ListItem>
            ))}
          </List>
        </Card>

        {/* Price Decay Alerts */}
        <Card>
          <Flex>
            <Title>Price Decay Alerts</Title>
            {m.decay_alert_count > 0 && (
              <BadgeDelta deltaType="decrease" size="sm">{m.decay_alert_count} lots</BadgeDelta>
            )}
          </Flex>
          {m.decay_alerts.length === 0 ? (
            <Text className="mt-4 text-gray-400">No lots need attention.</Text>
          ) : (
            <List className="mt-3">
              {m.decay_alerts.map((a, i) => (
                <ListItem key={i}>
                  <Flex>
                    <div>
                      <Text><Bold>{a.name}</Bold></Text>
                      <Text className="text-xs">{a.days_listed} days listed</Text>
                    </div>
                    <div className="text-right">
                      <Text><Bold>{formatMoney(a.current_price)}</Bold></Text>
                      <BadgeDelta deltaType="decrease" size="xs">-{a.decay_pct}%</BadgeDelta>
                    </div>
                  </Flex>
                </ListItem>
              ))}
            </List>
          )}
        </Card>
      </Grid>

      {/* ── Environmental Impact ── */}
      <Card className="mb-4">
        <Flex alignItems="start">
          <div>
            <Text className="text-green-700 font-semibold uppercase text-xs tracking-widest">
              Sustainability Metrics
            </Text>
            <Title className="mt-1">Environmental Impact</Title>
            <Text className="mt-1 max-w-lg">
              Every kilogram of fabric diverted prevents raw-material extraction, dye processing,
              and landfill methane emissions.
            </Text>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <div className="sdg-badge sdg-12">SDG 12<br/><span>Responsible</span></div>
            <div className="sdg-badge sdg-6">SDG 6<br/><span>Water</span></div>
            <div className="sdg-badge sdg-13">SDG 13<br/><span>Climate</span></div>
          </div>
        </Flex>

        <Divider />

        {/* Hero metrics — 4 Tremor Cards in a grid */}
        <Grid numItemsSm={2} numItemsLg={4} className="gap-3 mb-4">
          <Card decoration="top" decorationColor="green">
            <Text>CO₂ Prevented</Text>
            <Metric className="mt-1">{valueKg(m.total_carbon_saved_kg)}</Metric>
            <BadgeDelta deltaType="increase" size="xs" className="mt-2">Diverted</BadgeDelta>
          </Card>
          <Card decoration="top" decorationColor="blue">
            <Text>Water Conserved</Text>
            <Metric className="mt-1">{m.total_water_saved_l.toLocaleString()} L</Metric>
            <BadgeDelta deltaType="increase" size="xs" className="mt-2">Saved</BadgeDelta>
          </Card>
          <Card decoration="top" decorationColor="violet">
            <Text>Fabric Diverted</Text>
            <Metric className="mt-1">{valueKg(m.total_weight_kg)}</Metric>
            <BadgeDelta deltaType="increase" size="xs" className="mt-2">From landfill</BadgeDelta>
          </Card>
          <Card decoration="top" decorationColor="orange">
            <Text>Energy Saved</Text>
            <Metric className="mt-1">{m.energy_saved_kwh} kWh</Metric>
            <BadgeDelta deltaType="increase" size="xs" className="mt-2">Conserved</BadgeDelta>
          </Card>
        </Grid>

        {/* Equivalency grid — 8 small Tremor Cards */}
        <Grid numItemsSm={2} numItemsLg={4} className="gap-3 mb-5">
          {[
            { value: m.carbon_equiv_trees, label: 'Trees absorbing CO₂ for a year' },
            { value: m.carbon_equiv_car_miles.toLocaleString(), label: 'Miles of driving avoided' },
            { value: m.carbon_equiv_flights, label: 'Domestic flights offset' },
            { value: m.carbon_equiv_phones.toLocaleString(), label: 'Phone charges powered' },
            { value: m.water_equiv_showers.toLocaleString(), label: '8-minute showers' },
            { value: m.water_equiv_bathtubs.toLocaleString(), label: 'Bathtubs of water' },
            { value: m.water_equiv_bottles.toLocaleString(), label: '500 mL bottles' },
            { value: m.energy_equiv_homes, label: 'Homes powered for a year' },
          ].map((item, i) => (
            <Card key={i}>
              <Metric>{item.value}</Metric>
              <Text className="mt-1">{item.label}</Text>
            </Card>
          ))}
        </Grid>

        {/* Impact trend — Tremor AreaChart */}
        <Card>
          <Title>Cumulative CO₂ Saved — Last 30 Days</Title>
          <AreaChart
            className="mt-4 h-44"
            data={impactTrendData}
            index="date"
            categories={['CO₂ Saved (kg)']}
            colors={['green']}
            valueFormatter={valueKg}
            showLegend={false}
            showGridLines={true}
          />
        </Card>

        {/* CO2 by fabric — Tremor BarChart horizontal style via BarList */}
        <Card className="mt-3">
          <Title>CO₂ Saved by Fabric Type (kg)</Title>
          <BarList
            data={fabricImpactData.map(f => ({
              name: f.name,
              value: f['CO₂ (kg)'],
            }))}
            className="mt-4"
            color="green"
            valueFormatter={valueKg}
          />
        </Card>
      </Card>

      {/* ── Top Buyers — Tremor BarList ── */}
      <Card className="mb-4">
        <Title>Top Buyers</Title>
        <BarList
          data={topBuyersData}
          className="mt-4"
          color="green"
          valueFormatter={valueUSD}
        />
      </Card>

      {/* ── Fabric Breakdown — Tremor BarChart ── */}
      <Card className="mb-8">
        <Title>Fabric Inventory Breakdown</Title>
        <BarChart
          className="mt-4 h-52"
          data={m.fabric_stats.map(r => ({
            name: r.fabric_type.replace(/\/.*/, '').trim(),
            'Weight (kg)': r.weight_kg,
            Revenue: r.revenue,
          }))}
          index="name"
          categories={['Weight (kg)', 'Revenue']}
          colors={['slate', 'green']}
          valueFormatter={v => Number(v) < 1 ? formatWeightKg(v) : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })}
          showLegend={true}
        />
      </Card>
    </div>
  )
}
