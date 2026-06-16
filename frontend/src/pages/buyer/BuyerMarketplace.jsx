import { useEffect, useState } from 'react'
import { getLots } from '../../api.js'
import { useCart } from '../../context/CartContext.jsx'

export default function BuyerMarketplace() {
  const { cart, addToCart, updateQty, removeFromCart } = useCart()

  const [lots, setLots] = useState([])
  const [filters, setFilters] = useState({ fabric_type: '', color_name: '' })
  const [error, setError] = useState(null)

  function refresh() {
    const params = { status: 'available' }
    if (filters.fabric_type) params.fabric_type = filters.fabric_type
    if (filters.color_name) params.color_name = filters.color_name
    getLots(params).then(setLots).catch(e => setError(e.message))
  }

  useEffect(refresh, [filters])

  const fabricTypes = [...new Set(lots.map(l => l.fabric_type))].sort()
  const colors = [...new Set(lots.map(l => l.color_name))].sort()

  return (
    <div className="buyer-page">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 4 }}>Available Lots</h1>
        <p className="subtitle">B2B textile scrap marketplace — sorted, graded, and ready to ship.</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="buyer-filters">
        <span className="filter-label">Filter:</span>
        <select
          value={filters.fabric_type}
          onChange={e => setFilters(f => ({ ...f, fabric_type: e.target.value }))}
        >
          <option value="">All fabric types</option>
          {fabricTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filters.color_name}
          onChange={e => setFilters(f => ({ ...f, color_name: e.target.value }))}
        >
          <option value="">All colors</option>
          {colors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filters.fabric_type || filters.color_name) && (
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: '5px 10px' }}
            onClick={() => setFilters({ fabric_type: '', color_name: '' })}
          >
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-muted)' }}>
          {lots.length} lot{lots.length !== 1 ? 's' : ''} available
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {lots.map(lot => {
          const cartItem = cart[lot.id]
          const inCart = !!cartItem
          const qty = cartItem?.qty ?? 0
          const hasDecay = lot.price_decay_pct > 0
          const weightLb = (lot.weight_kg * 2.205).toFixed(1)
          const pricePerLb = (lot.current_price_usd / (lot.weight_kg * 2.205)).toFixed(2)

          return (
            <div className="buyer-lot-card" key={lot.id}>
              {/* Fabric color swatch */}
              <div className="buyer-lot-colorbar" style={{ background: lot.color_hex }}>
                <span className="buyer-lot-colorbar-label">{lot.color_name}</span>
              </div>

              <div className="buyer-lot-body">
                <div className="buyer-lot-header-row">
                  <div className="buyer-lot-type">{lot.fabric_type}</div>
                  <div className="buyer-lot-age">{lot.days_listed}d listed</div>
                </div>
                <div className="buyer-lot-name">{lot.name}</div>

                <div className="buyer-lot-price-row">
                  <span className="buyer-lot-price">${lot.current_price_usd.toFixed(2)}</span>
                  {hasDecay && (
                    <span className="buyer-lot-discount">−{lot.price_decay_pct}%</span>
                  )}
                </div>

                <div className="buyer-lot-perlb">
                  ${pricePerLb} / lb &nbsp;·&nbsp; was ${lot.price_usd.toFixed(2)}
                </div>

                <div className="buyer-lot-meta-row">
                  <span>{weightLb} lb</span>
                  <span>·</span>
                  <span>{lot.piece_count} pcs</span>
                </div>

                <div className="buyer-lot-impact">
                  {lot.carbon_saved_kg} kg CO₂ saved · {(lot.water_saved_l / 1000).toFixed(1)}K L water
                </div>

                <div className="buyer-qty-row">
                  <span className="buyer-qty-label">
                    {qty > 0 ? `${(qty * 2.205).toFixed(1)} lb` : 'Select qty'}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={lot.weight_kg}
                    step={0.5}
                    value={qty}
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      if (inCart) updateQty(lot.id, val)
                      else if (val > 0) addToCart(lot, null, val)
                    }}
                    className="buyer-slider"
                  />
                </div>

                <button
                  className={`buyer-lot-cta${inCart ? ' btn-added' : ''}`}
                  onClick={() => inCart ? removeFromCart(lot.id) : addToCart(lot, null, lot.weight_kg)}
                >
                  {inCart ? 'In Order — Remove' : 'Add to Order'}
                </button>
              </div>
            </div>
          )
        })}
        {lots.length === 0 && (
          <p className="muted" style={{ gridColumn: '1/-1', padding: '24px 0' }}>
            No lots match these filters.
          </p>
        )}
      </div>
    </div>
  )
}
