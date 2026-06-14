import { useEffect, useState } from 'react'

export default function AdminDashboard() {
  const [m, setM] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('scrap_token')
    fetch('/api/admin/metrics', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setM)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="error">{error}</div>
  if (!m) return <div className="muted">Loading metrics…</div>

  const pct = v => `${v}%`

  return (
    <div className="page">
      <h1>Admin Dashboard</h1>
      <p className="subtitle">Live metrics across all lots, buyers, and environmental impact.</p>

      {/* P&L */}
      <h2>Profit & Loss</h2>
      <div className="stat-grid">
        <div className="stat-card stat-card--green">
          <div className="stat-value">${m.revenue.toLocaleString()}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${m.estimated_cost.toLocaleString()}</div>
          <div className="stat-label">Est. Cost (28%)</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-value">${m.gross_profit.toLocaleString()}</div>
          <div className="stat-label">Gross Profit</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{pct(m.profit_margin_pct)}</div>
          <div className="stat-label">Profit Margin</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${m.inventory_value.toLocaleString()}</div>
          <div className="stat-label">Inventory Value</div>
        </div>
      </div>

      {/* Lot performance */}
      <h2>Lot Performance</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{m.total_lots}</div>
          <div className="stat-label">Total Lots</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-value">{m.claimed_lots}</div>
          <div className="stat-label">Lots Sold</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{m.available_lots}</div>
          <div className="stat-label">In Inventory</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-value">{pct(m.claim_rate_pct)}</div>
          <div className="stat-label">Sell-Through Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{m.avg_days_to_claim}d</div>
          <div className="stat-label">Avg Days to Sell</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{m.total_weight_kg} kg</div>
          <div className="stat-label">Total Fabric Handled</div>
        </div>
      </div>

      {/* Impact */}
      <h2>Environmental Impact</h2>
      <div className="stat-grid">
        <div className="stat-card stat-card--green">
          <div className="stat-value">{m.total_carbon_saved_kg} kg</div>
          <div className="stat-label">CO₂ Saved</div>
          <div className="stat-equiv">≈ {m.carbon_equiv_trees} trees/year</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-value">{m.total_water_saved_l.toLocaleString()} L</div>
          <div className="stat-label">Water Saved</div>
          <div className="stat-equiv">≈ {m.water_equiv_showers.toLocaleString()} showers</div>
        </div>
      </div>

      {/* Top buyers */}
      <h2>Top Buyers</h2>
      <table className="admin-table">
        <thead>
          <tr><th>Buyer</th><th>Lots Claimed</th><th>Total Value</th></tr>
        </thead>
        <tbody>
          {m.top_buyers.map(b => (
            <tr key={b.name}>
              <td>{b.name}</td>
              <td>{b.lots}</td>
              <td>${b.value.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Fabric breakdown */}
      <h2>Fabric Inventory Breakdown</h2>
      <table className="admin-table">
        <thead>
          <tr><th>Fabric Type</th><th>Lots</th><th>Weight (kg)</th><th>Revenue</th></tr>
        </thead>
        <tbody>
          {m.fabric_stats.map(r => (
            <tr key={r.fabric_type}>
              <td>{r.fabric_type}</td>
              <td>{r.lots}</td>
              <td>{r.weight_kg}</td>
              <td>${r.revenue.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
