import { useEffect, useState } from 'react'
import { getLots } from '../api.js'

// Person 3 (frontend) owns this screen. Person 2 (backend / lots / factory
// records) owns the /api/lots response shape -- see backend/app/schemas.py: LotOut.

export default function SortedLots() {
  const [lots, setLots] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    getLots().then(setLots).catch((err) => setError(err.message))
  }, [])

  return (
    <div className="page">
      <h1>Sorted lots</h1>
      <p className="subtitle">
        Clean, ready-to-sell groups created from sorted scraps and factory batch records.
      </p>

      {error && <div className="error">{error}</div>}

      <div className="lot-grid">
        {lots.map((lot) => (
          <div className="lot-card" key={lot.id}>
            <div className="swatch" style={{ background: lot.color_hex }} />
            <div className="lot-info">
              <h3>{lot.name}</h3>
              <p>{lot.fabric_type}</p>
              <p className="muted">{lot.composition}</p>
              {lot.description && <p className="lot-description">{lot.description}</p>}
              <div className="lot-stats">
                <span>{lot.piece_count} pieces</span>
                <span>{lot.weight_kg} kg</span>
                <span>${lot.price_usd}</span>
              </div>
              <div className="lot-impact">
                <span>{lot.carbon_saved_kg} kg CO2 saved</span>
                <span>{lot.water_saved_l.toLocaleString()} L water saved</span>
              </div>
              <span className={`status status-${lot.status}`}>
                {lot.status}
                {lot.claimed_by ? ` - ${lot.claimed_by}` : ''}
              </span>
            </div>
          </div>
        ))}
        {lots.length === 0 && !error && <p className="muted">No lots yet.</p>}
      </div>
    </div>
  )
}
