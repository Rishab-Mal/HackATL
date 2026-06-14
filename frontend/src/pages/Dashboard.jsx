import { useEffect, useState } from 'react'
import { getImpact } from '../api.js'

// Person 3 (frontend) owns this screen. Person 4 (marketplace, impact logic,
// demo data) owns the /api/impact response shape and the savings numbers.

export default function Dashboard() {
  const [impact, setImpact] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getImpact().then(setImpact).catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <div className="page">
        <div className="error">{error}</div>
      </div>
    )
  }
  if (!impact) {
    return <div className="page">Loading...</div>
  }

  return (
    <div className="page">
      <h1>Impact dashboard</h1>
      <p className="subtitle">How much fabric this is diverting from landfill, and what it's saving.</p>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{impact.total_weight_kg} kg</span>
          <span className="stat-label">Fabric diverted</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{impact.total_carbon_saved_kg} kg</span>
          <span className="stat-label">CO2 saved</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{impact.total_water_saved_l.toLocaleString()} L</span>
          <span className="stat-label">Water saved</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {impact.claimed_lots} / {impact.total_lots}
          </span>
          <span className="stat-label">Lots claimed</span>
        </div>
      </div>

      <h2>Breakdown by fabric type</h2>
      <ul className="breakdown">
        {Object.entries(impact.fabric_breakdown).map(([fabric, weight]) => (
          <li key={fabric}>
            <span>{fabric}</span>
            <span>{weight} kg</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
