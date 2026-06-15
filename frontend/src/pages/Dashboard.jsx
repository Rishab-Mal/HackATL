import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const COLORS = ['#2f7d4f', '#4caf7d', '#81c995', '#a8d5b5', '#c8e6d0', '#1a5c38', '#3d9e65', '#b6ddc4']

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

  return (
    <div className="dash">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Environmental Impact</h1>
          <p className="dash-subtitle">Scrap Sorter · Carter's Make &amp; Remake Pilot · Atlanta, GA</p>
        </div>
        <div className="sdg-badges">
          <div className="sdg-badge sdg-12">SDG 12<br /><span>Responsible Consumption</span></div>
          <div className="sdg-badge sdg-6">SDG 6<br /><span>Clean Water</span></div>
          <div className="sdg-badge sdg-13">SDG 13<br /><span>Climate Action</span></div>
        </div>
      </div>

      {/* Mission statement */}
      <div className="impact-mission">
        <div className="impact-mission-text">
          <div className="impact-eyebrow">Our Mission</div>
          <p>Every kilogram of fabric diverted from landfill prevents raw-material extraction, toxic dye processing, and methane emissions from decomposition. Scrap Sorter turns factory waste into a circular supply chain.</p>
        </div>
        <div className="impact-mission-stat">
          <div className="impact-mission-num">{m.diversion_pct}%</div>
          <div className="impact-mission-label">of 500 kg pilot goal reached</div>
          <div className="diversion-bar-track" style={{ marginTop: '0.75rem' }}>
            <div className="diversion-bar-fill" style={{ width: `${m.diversion_pct}%` }} />
          </div>
        </div>
      </div>

      {/* Hero numbers */}
      <div className="impact-hero-row">
        <div className="impact-hero-card impact-hero--carbon">
          <div className="impact-hero-icon">🌿</div>
          <div className="impact-hero-value">{m.total_carbon_saved_kg} kg</div>
          <div className="impact-hero-label">CO₂ Emissions Prevented</div>
        </div>
        <div className="impact-hero-card impact-hero--water">
          <div className="impact-hero-icon">💧</div>
          <div className="impact-hero-value">{m.total_water_saved_l.toLocaleString()} L</div>
          <div className="impact-hero-label">Water Conserved</div>
        </div>
        <div className="impact-hero-card impact-hero--fabric">
          <div className="impact-hero-icon">♻️</div>
          <div className="impact-hero-value">{m.total_weight_kg} kg</div>
          <div className="impact-hero-label">Fabric Diverted from Landfill</div>
        </div>
        <div className="impact-hero-card impact-hero--energy">
          <div className="impact-hero-icon">⚡</div>
          <div className="impact-hero-value">{m.energy_saved_kwh.toLocaleString()} kWh</div>
          <div className="impact-hero-label">Energy Saved</div>
        </div>
      </div>

      {/* Equivalency grid */}
      <div className="impact-equiv-header">
        <div className="impact-eyebrow" style={{ margin: '1.5rem 0 0.75rem' }}>What that actually means</div>
      </div>
      <div className="equiv-grid">
        <div className="equiv-card">
          <div className="equiv-icon">🌳</div>
          <div className="equiv-value">{m.carbon_equiv_trees}</div>
          <div className="equiv-label">Trees absorbing CO₂ for a full year</div>
        </div>
        <div className="equiv-card">
          <div className="equiv-icon">🚗</div>
          <div className="equiv-value">{m.carbon_equiv_car_miles.toLocaleString()}</div>
          <div className="equiv-label">Miles of driving avoided</div>
        </div>
        <div className="equiv-card">
          <div className="equiv-icon">✈️</div>
          <div className="equiv-value">{m.carbon_equiv_flights}</div>
          <div className="equiv-label">Domestic flights offset</div>
        </div>
        <div className="equiv-card">
          <div className="equiv-icon">📱</div>
          <div className="equiv-value">{m.carbon_equiv_phones.toLocaleString()}</div>
          <div className="equiv-label">Phone charges powered</div>
        </div>
        <div className="equiv-card">
          <div className="equiv-icon">🚿</div>
          <div className="equiv-value">{m.water_equiv_showers.toLocaleString()}</div>
          <div className="equiv-label">8-minute showers saved</div>
        </div>
        <div className="equiv-card">
          <div className="equiv-icon">🛁</div>
          <div className="equiv-value">{m.water_equiv_bathtubs.toLocaleString()}</div>
          <div className="equiv-label">Bathtubs of water conserved</div>
        </div>
        <div className="equiv-card">
          <div className="equiv-icon">🍶</div>
          <div className="equiv-value">{m.water_equiv_bottles.toLocaleString()}</div>
          <div className="equiv-label">500ml bottles not consumed</div>
        </div>
        <div className="equiv-card">
          <div className="equiv-icon">🏠</div>
          <div className="equiv-value">{m.energy_equiv_homes}</div>
          <div className="equiv-label">Homes powered for a year</div>
        </div>
      </div>

      {/* Cumulative CO₂ trend */}
      <div className="chart-card" style={{ marginTop: '1.75rem' }}>
        <div className="chart-card-title">Cumulative CO₂ Saved — Last 30 Days (kg)</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={m.impact_trend} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e4e9" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}kg`} />
            <Tooltip formatter={v => [`${v} kg`, 'CO₂ Saved']} />
            <Line type="monotone" dataKey="carbon_kg" stroke="#2f7d4f" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CO₂ by fabric type */}
      <div className="chart-card" style={{ marginTop: '1rem' }}>
        <div className="chart-card-title">CO₂ Saved by Fabric Type (kg)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={m.fabric_impact} layout="vertical" margin={{ top: 4, right: 50, bottom: 0, left: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e4e9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}kg`} />
            <YAxis type="category" dataKey="fabric" tick={{ fontSize: 11 }} width={90} />
            <Tooltip formatter={v => [`${v} kg`, 'CO₂ Saved']} />
            <Bar dataKey="carbon_kg" radius={[0, 4, 4, 0]}>
              {m.fabric_impact.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Carter's contribution */}
      <div className="carters-card" style={{ marginTop: '1.75rem' }}>
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
          Carter's Atlanta supplier offcuts → sorted by Scrap Sorter CV pipeline → claimed by Looptex Recyclers
        </div>
      </div>

      {/* Fabric breakdown table */}
      <div className="impact-eyebrow" style={{ margin: '1.75rem 0 0.75rem' }}>Fabric-level breakdown</div>
      <div className="table-card" style={{ marginBottom: '3rem' }}>
        <table className="admin-table">
          <thead>
            <tr><th>Fabric Type</th><th>Lots</th><th>Weight (kg)</th><th>CO₂ Saved (kg)</th><th>Water Saved (L)</th></tr>
          </thead>
          <tbody>
            {m.fabric_stats.map(r => (
              <tr key={r.fabric_type}>
                <td>{r.fabric_type}</td>
                <td>{r.lots}</td>
                <td>{r.weight_kg}</td>
                <td>{(r.weight_kg * 2.1).toFixed(1)}</td>
                <td>{(r.weight_kg * 2700).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
