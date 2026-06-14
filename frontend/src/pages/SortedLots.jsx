import { useEffect, useState } from 'react'
import { getLotFilterOptions, getLots } from '../api.js'
import LotFilters from '../components/LotFilters.jsx'

// Person 3 (frontend) owns this screen. Person 2 (backend / lots / factory
// records) owns the /api/lots response shape -- see backend/app/schemas.py: LotOut.

const EMPTY_FILTERS = { fabric_type: '', color_name: '', min_price: '', max_price: '' }

export default function SortedLots() {
  const [lots, setLots] = useState([])
  const [options, setOptions] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [error, setError] = useState(null)

  useEffect(() => {
    getLotFilterOptions().then(setOptions).catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    getLots(filters).then(setLots).catch((err) => setError(err.message))
  }, [filters])

  return (
    <div className="page">
      <h1>Sorted lots</h1>
      <p className="subtitle">
        Clean, ready-to-sell groups created from sorted scraps and factory batch records.
      </p>

      {error && <div className="error">{error}</div>}

      <LotFilters options={options} filters={filters} onChange={setFilters} />

      <p className="muted result-count">
        {lots.length} lot{lots.length === 1 ? '' : 's'}
      </p>

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
        {lots.length === 0 && !error && <p className="muted">No lots match these filters.</p>}
      </div>
    </div>
  )
}
