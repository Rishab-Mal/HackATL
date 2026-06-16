import { useEffect, useState } from 'react'
import { getBuyers, getLotFilterOptions, getLots } from '../api.js'
import { useCart } from '../context/CartContext.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'
import CarterSpotlight from '../components/CarterSpotlight.jsx'
import LotFilters from '../components/LotFilters.jsx'
import { formatMoney, formatWeightKg } from '../utils/formatters.js'

const EMPTY_FILTERS = { fabric_type: '', color_name: '', min_price: '', max_price: '' }

export default function Marketplace() {
  const { cart, addToCart, removeFromCart, lastSuccess } = useCart()

  const [lots, setLots] = useState([])
  const [buyers, setBuyers] = useState([])
  const [options, setOptions] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [error, setError] = useState(null)
  const [selectedBuyer, setSelectedBuyer] = useState({})
  const [activityVersion, setActivityVersion] = useState(0)

  useEffect(() => {
    getLotFilterOptions().then(setOptions).catch(err => setError(err.message))
    getBuyers().then(setBuyers).catch(err => setError(err.message))
  }, [])

  function refreshLots() {
    getLots({ status: 'available', ...filters }).then(setLots).catch(err => setError(err.message))
  }

  useEffect(refreshLots, [filters])

  // Re-fetch lots when a checkout completes (lastSuccess changes)
  useEffect(() => {
    if (lastSuccess) {
      refreshLots()
      setActivityVersion(v => v + 1)
    }
  }, [lastSuccess])

  return (
    <div className="page">
      <h1>Marketplace</h1>
      <p className="subtitle">Assign available lots to recyclers and makers.</p>

      {error && <div className="error">{error}</div>}

      <CarterSpotlight />
      <ActivityFeed refreshKey={activityVersion} />

      <h2>Available lots</h2>
      <LotFilters options={options} filters={filters} onChange={setFilters} />

      <p className="muted result-count">
        {lots.length} lot{lots.length === 1 ? '' : 's'} available
      </p>

      <div className="lot-grid">
        {lots.map(lot => {
          const inCart = !!cart[lot.id]
          const buyer = selectedBuyer[lot.id] || ''

          return (
            <div className="lot-card" key={lot.id}>
              <div className="swatch" style={{ background: lot.color_hex }} />
              <div className="lot-info">
                <h3>{lot.name}</h3>
                <p className="muted">{lot.fabric_type} · {formatWeightKg(lot.weight_kg)}</p>
                <div className="lot-stats">
                  <span className="lot-price">
                    {formatMoney(lot.current_price_usd)}
                    {lot.price_decay_pct > 0 && (
                      <span className="decay-badge">↓{lot.price_decay_pct}%</span>
                    )}
                  </span>
                </div>
                {lot.price_decay_pct > 0 && (
                  <p className="muted decay-hint">
                    Listed {lot.days_listed}d ago · was {formatMoney(lot.price_usd)}
                  </p>
                )}
                <div className="claim-row">
                  <select
                    value={buyer}
                    onChange={e => setSelectedBuyer(prev => ({ ...prev, [lot.id]: e.target.value }))}
                    disabled={inCart}
                  >
                    <option value="" disabled>Choose buyer</option>
                    {buyers.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                  {inCart ? (
                    <button
                      style={{ background: 'var(--green-700)', fontSize: 12, padding: '6px 10px' }}
                      onClick={() => removeFromCart(lot.id)}
                    >
                      ✓ In cart
                    </button>
                  ) : (
                    <button
                      onClick={() => addToCart(lot, buyer)}
                      disabled={!buyer}
                      style={{ fontSize: 12, padding: '6px 10px' }}
                    >
                      Add to cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {lots.length === 0 && !error && (
          <p className="muted">No available lots match these filters.</p>
        )}
      </div>

      <h2>Recyclers &amp; makers</h2>
      <div className="buyer-grid">
        {buyers.map(b => (
          <div className="buyer-card" key={b.id}>
            <h3>{b.name}</h3>
            <span className="buyer-type">{b.type} · {b.location}</span>
            <p>{b.description}</p>
            <div className="tags">
              {b.interested_materials.map(m => (
                <span className="tag" key={m}>{m}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
