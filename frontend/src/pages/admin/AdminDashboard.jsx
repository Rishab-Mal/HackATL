import { useEffect, useState, useCallback } from 'react'
import {
  Card, Grid, Col, Metric, Text, Title, Bold, Flex,
  AreaChart, DonutChart, BarList, ProgressBar,
} from '@tremor/react'
import { delistLot } from '../../api.js'

const fmt$ = v =>
  '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtKg = v => `${Number(v).toLocaleString()} kg`

// Fabric-type → brand color for activity dots
const FABRIC_COLORS = {
  'Cotton Twill':           '#2d5016',
  'Cotton':                 '#4a7c59',
  'Linen':                  '#c4a882',
  'Modal':                  '#7e6b8f',
  'French Terry':           '#2d3f5e',
  'Ribbed Knit':            '#5c4a3a',
  'Organic Cotton Jersey':  '#3d7d5e',
  'Denim':                  '#2c3e6b',
  'Wool Blend':             '#8b7355',
  'Canvas':                 '#1c1c1c',
}
const fabricColor = t => FABRIC_COLORS[t] || '#94a3b8'

function KpiStrip({ m }) {
  const items = [
    {
      label: 'Revenue',
      value: fmt$(m.revenue),
      sub: `${m.claimed_lots} lots claimed`,
      green: false,
    },
    {
      label: 'Gross Profit',
      value: fmt$(m.gross_profit),
      sub: `${m.profit_margin_pct}% margin`,
      green: false,
    },
    {
      label: 'Inventory Value',
      value: fmt$(m.inventory_value),
      sub: `${m.available_lots} lots available`,
      green: false,
    },
    {
      label: 'Sell-Through',
      value: `${m.claim_rate_pct}%`,
      sub: `Avg ${m.avg_days_to_claim}d to sell`,
      warn: m.claim_rate_pct < 50,
    },
    {
      label: 'CO₂ Prevented',
      value: fmtKg(m.total_carbon_saved_kg),
      sub: `${m.total_weight_kg} kg fabric`,
      green: true,
    },
  ]

  return (
    <div className="admin-kpi-strip">
      {items.map((k, i) => (
        <div key={i} className={`admin-kpi-item${i > 0 ? ' admin-kpi-item--border' : ''}`}>
          <div className="admin-kpi-label">{k.label}</div>
          <div className={`admin-kpi-value${k.green ? ' admin-kpi-value--green' : ''}`}>{k.value}</div>
          <div className={`admin-kpi-sub${k.warn ? ' admin-kpi-sub--warn' : ''}${k.green ? ' admin-kpi-sub--pos' : ''}`}>
            {k.sub}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const [m, setM]                   = useState(null)
  const [error, setError]           = useState(null)
  const [refreshed, setRefreshed]   = useState(null)
  const [tab, setTab]               = useState('ops')
  const [range, setRange]           = useState(14)
  const [sortCol, setSortCol]       = useState('revenue')
  const [sortDir, setSortDir]       = useState(-1)
  const [delistedIds, setDelistedIds] = useState({})
  const [acting, setActing]         = useState({})

  const fetchMetrics = useCallback(() => {
    const token = localStorage.getItem('scrap_token')
    fetch('/api/admin/metrics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setM(data); setRefreshed(new Date()) })
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  if (error) return <div className="error">{error}</div>
  if (!m)    return <div className="dash-loading"><div className="dash-spinner" />Loading dashboard…</div>

  // ── Derived ──────────────────────────────────────────────────
  const sliceN     = range === 999 ? undefined : -range
  const revenueData = m.revenue_trend.slice(sliceN).map(d => ({
    date: d.date,
    'Revenue ($)': d.revenue,
  }))
  const impactData = m.impact_trend.slice(sliceN).map(d => ({
    date: d.date,
    'CO₂ (kg)': d.carbon_kg,
  }))
  const inventoryData = [
    { name: 'Claimed',   value: m.claimed_lots },
    { name: 'Available', value: m.available_lots },
    ...(m.unlisted_lots > 0 ? [{ name: 'Unlisted', value: m.unlisted_lots }] : []),
  ]
  const activeAlerts = (m.decay_alerts || []).filter(a => !delistedIds[a.id])

  const sortedFabrics = [...m.fabric_stats].sort((a, b) => {
    const va = a[sortCol] ?? 0
    const vb = b[sortCol] ?? 0
    return sortDir * (vb > va ? 1 : -1)
  })

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(-1) }
  }

  async function handleDelist(id) {
    setActing(a => ({ ...a, [id]: true }))
    try {
      await delistLot(id)
      setDelistedIds(d => ({ ...d, [id]: true }))
    } catch (e) {
      console.error(e)
    } finally {
      setActing(a => ({ ...a, [id]: false }))
    }
  }

  const refreshLabel = refreshed
    ? `Updated ${refreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : ''

  const SortTh = ({ col, label }) => (
    <th
      className={`admin-th admin-th--sort${sortCol === col ? ' admin-th--active' : ''}`}
      onClick={() => toggleSort(col)}
    >
      {label}
      <span className="admin-sort-arrow">
        {sortCol === col ? (sortDir === -1 ? ' ↓' : ' ↑') : ' ↕'}
      </span>
    </th>
  )

  return (
    <div className="dash admin-dash">

      {/* ── Header ───────────────────────────────── */}
      <div className="admin-header">
        <div>
          <div className="admin-header-eyebrow">fibr · Carter's Make &amp; Remake · Atlanta 2026</div>
          <h1 className="admin-header-title">
            {tab === 'ops' ? 'Operations' : tab === 'impact' ? 'Sustainability' : 'Market Intelligence'}
          </h1>
        </div>
        <div className="admin-header-right">
          <span className="admin-refresh-label">{refreshLabel}</span>
          <span className="admin-live-badge">
            <span className="admin-live-dot" />
            Live
          </span>
          <button className="admin-refresh-btn" onClick={fetchMetrics}>↻ Refresh</button>
        </div>
      </div>

      {/* ── KPI Strip ────────────────────────────── */}
      <KpiStrip m={m} />

      {/* ── Tab Bar ──────────────────────────────── */}
      <div className="admin-tabs">
        <div className="admin-tab-list">
          {[
            { id: 'ops',    label: 'Operations' },
            { id: 'impact', label: 'Sustainability' },
            { id: 'buyers', label: 'Market' },
          ].map(t => (
            <button
              key={t.id}
              className={`admin-tab${tab === t.id ? ' admin-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'buyers' && (
          <div className="admin-date-filter">
            {[{ v: 7, l: '7d' }, { v: 14, l: '14d' }, { v: 30, l: '30d' }, { v: 999, l: 'All' }].map(r => (
              <button
                key={r.v}
                className={`admin-date-btn${range === r.v ? ' admin-date-btn--active' : ''}`}
                onClick={() => setRange(r.v)}
              >
                {r.l}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════ OPERATIONS TAB ══════════════ */}
      {tab === 'ops' && (
        <>
          {/* Revenue chart + Inventory donut */}
          <Grid numItemsLg={3} className="gap-3 mb-4">
            <Col numColSpanLg={2}>
              <Card>
                <div className="admin-card-header">
                  <Title>Revenue Trend</Title>
                  <Text style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                    {range === 999 ? 'All time' : `Last ${range} days`}
                  </Text>
                </div>
                <AreaChart
                  className="mt-4 h-52"
                  data={revenueData}
                  index="date"
                  categories={['Revenue ($)']}
                  colors={['green']}
                  valueFormatter={fmt$}
                  showLegend={false}
                  showGridLines={false}
                  curveType="monotone"
                />
              </Card>
            </Col>

            <Card>
              <div className="admin-card-header">
                <Title>Inventory Status</Title>
                <Text style={{ fontSize: 12, color: 'var(--c-muted)' }}>{m.total_lots} total lots</Text>
              </div>
              <DonutChart
                className="mt-2 h-44"
                data={inventoryData}
                category="value"
                index="name"
                colors={['emerald', 'slate', 'red']}
                label={`${m.claim_rate_pct}%`}
              />
              <div className="admin-donut-legend">
                {inventoryData.map((d, i) => (
                  <div key={i} className="admin-donut-row">
                    <div
                      className="admin-donut-dot"
                      style={{ background: ['#10b981', '#94a3b8', '#ef4444'][i] }}
                    />
                    <span className="admin-donut-name">{d.name}</span>
                    <span className="admin-donut-val">{d.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Grid>

          {/* Carter's Pilot */}
          <div className="carters-card" style={{ marginBottom: 16 }}>
            <div className="carters-card-header">
              <div>
                <div className="carters-card-eyebrow">Supplier Pilot · Running Live</div>
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
                <div className="carters-stat-value">${m.carters_revenue.toFixed(0)}</div>
                <div className="carters-stat-label">Revenue Generated</div>
              </div>
              <div className="carters-stat">
                <div className="carters-stat-value">{m.carters_carbon_kg} kg</div>
                <div className="carters-stat-label">CO₂ Avoided</div>
              </div>
            </div>
            <div className="carters-card-footer">
              Carter's Atlanta supplier offcuts → fibr CV pipeline → sorted by color/fabric → claimed by Looptex Recyclers
            </div>
          </div>

          {/* Activity Feed + Decay Alerts */}
          <Grid numItemsLg={2} className="gap-3 mb-4">

            {/* Activity Feed */}
            <Card>
              <div className="admin-card-header">
                <Title>Recent Activity</Title>
                <span className="admin-count-badge">{m.activity_feed.length} latest</span>
              </div>
              <div className="admin-activity-list">
                {m.activity_feed.map((a, i) => (
                  <div key={i} className="admin-activity-item">
                    <div
                      className="admin-activity-dot"
                      style={{ background: fabricColor(a.fabric_type) }}
                    />
                    <div className="admin-activity-info">
                      <div className="admin-activity-name">{a.lot_name}</div>
                      <div className="admin-activity-meta">{a.buyer} · {a.fabric_type}</div>
                    </div>
                    <div className="admin-activity-right">
                      <div className="admin-activity-price">{fmt$(a.price)}</div>
                      <div className="admin-activity-age">
                        {a.days_ago === 0 ? 'Today' : `${a.days_ago}d ago`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Decay Alerts */}
            <Card>
              <div className="admin-card-header">
                <Title>Price Decay Alerts</Title>
                {activeAlerts.length > 0
                  ? <span className="admin-alert-badge">{activeAlerts.length} lots</span>
                  : <span className="admin-ok-badge">All clear</span>
                }
              </div>
              <div className="admin-decay-list">
                {activeAlerts.length === 0 ? (
                  <div className="admin-empty-state">
                    <div className="admin-empty-icon">✓</div>
                    <div className="admin-empty-text">No lots need attention right now.</div>
                  </div>
                ) : activeAlerts.map(a => (
                  <div key={a.id} className="admin-decay-item">
                    <div className="admin-decay-info">
                      <div className="admin-decay-name">{a.name}</div>
                      <div className="admin-decay-meta">{a.fabric_type} · {a.days_listed}d listed</div>
                    </div>
                    <div className="admin-decay-prices">
                      <div className="admin-decay-current">${a.current_price}</div>
                      <div className="admin-decay-pct">−{a.decay_pct}%</div>
                    </div>
                    <button
                      className="admin-delist-btn"
                      disabled={acting[a.id]}
                      onClick={() => handleDelist(a.id)}
                    >
                      {acting[a.id] ? '…' : 'Delist'}
                    </button>
                  </div>
                ))}
              </div>
            </Card>

          </Grid>
        </>
      )}

      {/* ═══════════════ SUSTAINABILITY TAB ═══════════════ */}
      {tab === 'impact' && (
        <>
          {/* 4 hero impact KPIs */}
          <Grid numItemsSm={2} numItemsLg={4} className="gap-3 mb-4">
            {[
              { label: 'CO₂ Prevented',    value: `${m.total_carbon_saved_kg.toLocaleString()} kg`, color: 'green',  sub: 'Carbon emissions avoided' },
              { label: 'Water Conserved',  value: `${(m.total_water_saved_l / 1000).toFixed(0)}K L`, color: 'blue',  sub: 'Liters of water saved' },
              { label: 'Energy Saved',     value: `${m.energy_saved_kwh.toLocaleString()} kWh`,     color: 'amber', sub: 'Textile production energy' },
              { label: 'Fabric Diverted',  value: `${m.total_weight_kg} kg`,                        color: 'violet', sub: 'Kept out of landfill' },
            ].map((k, i) => (
              <Card key={i} decoration="top" decorationColor={k.color}>
                <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-muted)' }}>{k.label}</Text>
                <Metric className="mt-2">{k.value}</Metric>
                <Text className="mt-1" style={{ fontSize: 12, color: 'var(--c-secondary)' }}>{k.sub}</Text>
              </Card>
            ))}
          </Grid>

          {/* Diversion progress */}
          <Card className="mb-4">
            <div className="admin-progress-header">
              <div>
                <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-accent)' }}>
                  Pilot Goal · 500 kg fabric diverted
                </Text>
                <Metric className="mt-1">{m.diversion_pct}% Complete</Metric>
              </div>
              <div className="admin-sdg-row">
                <div className="sdg-badge sdg-12">SDG 12<br /><span>Responsible</span></div>
                <div className="sdg-badge sdg-6">SDG 6<br /><span>Water</span></div>
                <div className="sdg-badge sdg-13">SDG 13<br /><span>Climate</span></div>
              </div>
            </div>
            <ProgressBar value={Math.min(m.diversion_pct, 100)} color="green" className="mt-4" />
            <Flex className="mt-2">
              <Text style={{ fontSize: 12 }}><Bold>{m.total_weight_kg} kg</Bold> diverted so far</Text>
              <Text style={{ fontSize: 12 }}>{Math.max(0, 500 - m.total_weight_kg).toFixed(0)} kg to goal</Text>
            </Flex>
          </Card>

          {/* CO₂ Trend */}
          <Card className="mb-4">
            <div className="admin-card-header">
              <Title>Cumulative CO₂ Prevented</Title>
              <Text style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                {range === 999 ? 'All time' : `Last ${range} days`}
              </Text>
            </div>
            <AreaChart
              className="mt-4 h-52"
              data={impactData}
              index="date"
              categories={['CO₂ (kg)']}
              colors={['green']}
              valueFormatter={v => `${v} kg`}
              showLegend={false}
              showGridLines={false}
              curveType="monotone"
            />
          </Card>

          {/* Equivalency cards */}
          <div className="admin-equiv-section-label">What that actually means</div>
          <Grid numItemsSm={2} numItemsLg={4} className="gap-3 mb-4">
            {[
              { value: m.carbon_equiv_trees,              label: 'Trees absorbing CO₂ for a year' },
              { value: m.carbon_equiv_car_miles.toLocaleString(), label: 'Miles of driving avoided' },
              { value: m.carbon_equiv_flights,            label: 'Domestic flights offset' },
              { value: m.carbon_equiv_phones.toLocaleString(), label: 'Phone charges powered' },
              { value: m.water_equiv_showers.toLocaleString(), label: '8-minute showers saved' },
              { value: m.water_equiv_bathtubs.toLocaleString(), label: 'Bathtubs of water' },
              { value: m.water_equiv_bottles.toLocaleString(), label: '500 mL bottles not consumed' },
              { value: m.energy_equiv_homes,              label: 'Homes powered for a year' },
            ].map((item, i) => (
              <Card key={i}>
                <div className="admin-equiv-value">{item.value}</div>
                <div className="admin-equiv-label">{item.label}</div>
              </Card>
            ))}
          </Grid>

          {/* CO₂ by fabric */}
          <Card className="mb-4">
            <Title>CO₂ Saved by Fabric Type</Title>
            <BarList
              data={m.fabric_impact.map(f => ({ name: f.fabric, value: f.carbon_kg }))}
              className="mt-4"
              color="green"
              valueFormatter={v => `${v} kg`}
            />
          </Card>
        </>
      )}

      {/* ═══════════════ MARKET TAB ═══════════════ */}
      {tab === 'buyers' && (
        <>
          <Grid numItemsLg={2} className="gap-3 mb-4">

            {/* Ranked buyer list */}
            <Card>
              <Title>Top Buyers by Revenue</Title>
              <div className="admin-buyer-list">
                {m.top_buyers.length === 0 ? (
                  <div className="admin-empty-state">
                    <div className="admin-empty-text">No buyers yet.</div>
                  </div>
                ) : m.top_buyers.map((b, i) => {
                  const share = m.revenue > 0 ? (b.value / m.revenue * 100) : 0
                  const initials = b.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <div key={i} className="admin-buyer-row">
                      <div className="admin-buyer-rank">{i + 1}</div>
                      <div className="admin-buyer-avatar">{initials}</div>
                      <div className="admin-buyer-info">
                        <div className="admin-buyer-name">{b.name}</div>
                        <div className="admin-buyer-meta">{b.lots} lot{b.lots !== 1 ? 's' : ''} claimed</div>
                      </div>
                      <div className="admin-buyer-right">
                        <div className="admin-buyer-value">{fmt$(b.value)}</div>
                        <div className="admin-buyer-bar-wrap">
                          <div className="admin-buyer-bar" style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Revenue by fabric */}
            <Card>
              <Title>Revenue by Fabric Type</Title>
              <BarList
                data={m.fabric_stats.filter(f => f.revenue > 0).map(f => ({
                  name: f.fabric_type,
                  value: f.revenue,
                }))}
                className="mt-4"
                color="green"
                valueFormatter={fmt$}
              />
            </Card>
          </Grid>

          {/* Sortable fabric performance table */}
          <Card className="mb-4">
            <div className="admin-card-header" style={{ marginBottom: 12 }}>
              <Title>Fabric Performance</Title>
              <Text style={{ fontSize: 12, color: 'var(--c-muted)' }}>Click column to sort</Text>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="admin-th">Fabric</th>
                    <SortTh col="lots"      label="Lots" />
                    <SortTh col="weight_kg" label="Weight" />
                    <SortTh col="revenue"   label="Revenue" />
                  </tr>
                </thead>
                <tbody>
                  {sortedFabrics.map((f, i) => {
                    const pct = m.revenue > 0 ? (f.revenue / m.revenue * 100) : 0
                    return (
                      <tr key={i} className="admin-tr">
                        <td className="admin-td admin-td--fabric">
                          <div
                            className="admin-fabric-dot"
                            style={{ background: fabricColor(f.fabric_type) }}
                          />
                          {f.fabric_type}
                        </td>
                        <td className="admin-td admin-td--num">{f.lots}</td>
                        <td className="admin-td admin-td--num">{f.weight_kg} kg</td>
                        <td className="admin-td admin-td--num">
                          <div className="admin-td-revenue">
                            {fmt$(f.revenue)}
                            <div className="admin-revenue-bar">
                              <div className="admin-revenue-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

    </div>
  )
}
