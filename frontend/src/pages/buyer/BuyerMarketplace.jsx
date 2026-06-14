import { useEffect, useState } from 'react'
import { getLots, getBuyers, claimLot } from '../../api.js'
import { useAuth } from '../../context/AuthContext.jsx'

export default function BuyerMarketplace() {
  const { user } = useAuth()
  const [lots, setLots] = useState([])
  const [filters, setFilters] = useState({ fabric_type: '', color_name: '' })
  const [cart, setCart] = useState({})       // { [lotId]: { lot, qty } }
  const [cartOpen, setCartOpen] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  function refresh() {
    const params = {}
    if (filters.fabric_type) params.fabric_type = filters.fabric_type
    if (filters.color_name) params.color_name = filters.color_name
    params.status = 'available'
    getLots(params).then(setLots).catch(e => setError(e.message))
  }

  useEffect(refresh, [filters])

  const fabricTypes = [...new Set(lots.map(l => l.fabric_type))].sort()
  const colors = [...new Set(lots.map(l => l.color_name))].sort()

  function setQty(lot, qty) {
    if (qty <= 0) {
      const next = { ...cart }
      delete next[lot.id]
      setCart(next)
    } else {
      setCart(prev => ({ ...prev, [lot.id]: { lot, qty } }))
    }
  }

  const cartItems = Object.values(cart)
  const cartTotal = cartItems.reduce((s, { lot, qty }) => s + lot.current_price_usd * (qty / lot.weight_kg), 0)

  async function placeOrder() {
    setError(null)
    try {
      for (const { lot } of cartItems) {
        await claimLot(lot.id, user.name)
      }
      setCart({})
      setCartOpen(false)
      setSuccess(`Order placed for ${cartItems.length} lot${cartItems.length > 1 ? 's' : ''}! The factory will be in touch.`)
      refresh()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="buyer-page">
      <div className="buyer-main">
        <h1>Browse Lots</h1>
        <p className="subtitle">Filter by material or color, then add lots to your cart.</p>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {/* Filters */}
        <div className="buyer-filters">
          <select value={filters.fabric_type} onChange={e => setFilters(f => ({ ...f, fabric_type: e.target.value }))}>
            <option value="">All fabric types</option>
            {fabricTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.color_name} onChange={e => setFilters(f => ({ ...f, color_name: e.target.value }))}>
            <option value="">All colors</option>
            {colors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn-ghost" onClick={() => setFilters({ fabric_type: '', color_name: '' })}>Clear</button>
        </div>

        <p className="muted">{lots.length} lots available</p>

        <div className="lot-grid">
          {lots.map(lot => {
            const inCart = cart[lot.id]
            const qty = inCart?.qty ?? 0
            return (
              <div className="lot-card buyer-lot-card" key={lot.id}>
                <div className="swatch" style={{ background: lot.color_hex }} />
                <div className="lot-info">
                  <h3>{lot.name}</h3>
                  <p className="muted">{lot.fabric_type} · {lot.composition}</p>
                  <div className="lot-stats">
                    <span>{lot.piece_count} pcs</span>
                    <span>{lot.weight_kg} kg total</span>
                    <span className="lot-price">
                      ${lot.current_price_usd.toFixed(2)}
                      {lot.price_decay_pct > 0 && <span className="decay-badge">↓{lot.price_decay_pct}%</span>}
                    </span>
                  </div>

                  <div className="buyer-qty-row">
                    <label className="buyer-qty-label">
                      Qty: <strong>{qty > 0 ? `${qty} kg` : '—'}</strong>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={lot.weight_kg}
                      step={0.5}
                      value={qty}
                      onChange={e => setQty(lot, parseFloat(e.target.value))}
                      className="buyer-slider"
                    />
                  </div>
                  <button
                    className={inCart ? 'btn-added' : ''}
                    onClick={() => setQty(lot, qty > 0 ? 0 : lot.weight_kg)}
                  >
                    {inCart ? '✓ In cart' : 'Add to cart'}
                  </button>
                </div>
              </div>
            )
          })}
          {lots.length === 0 && <p className="muted">No lots match these filters.</p>}
        </div>
      </div>

      {/* Cart button */}
      {cartItems.length > 0 && (
        <button className="cart-toggle" onClick={() => setCartOpen(o => !o)}>
          🛒 {cartItems.length} · ${cartTotal.toFixed(2)}
        </button>
      )}

      {/* Cart panel */}
      {cartOpen && (
        <div className="cart-panel">
          <div className="cart-header">
            <h2>Your Cart</h2>
            <button className="chat-close" onClick={() => setCartOpen(false)}>✕</button>
          </div>
          <div className="cart-items">
            {cartItems.map(({ lot, qty }) => (
              <div className="cart-item" key={lot.id}>
                <div className="cart-swatch" style={{ background: lot.color_hex }} />
                <div className="cart-item-info">
                  <div className="cart-item-name">{lot.name}</div>
                  <div className="cart-item-meta">{qty} kg · ${(lot.current_price_usd * qty / lot.weight_kg).toFixed(2)}</div>
                </div>
                <button className="cart-remove" onClick={() => setQty(lot, 0)}>✕</button>
              </div>
            ))}
          </div>
          <div className="cart-footer">
            <div className="cart-total">Total: <strong>${cartTotal.toFixed(2)}</strong></div>
            <button onClick={placeOrder}>Place Order →</button>
          </div>
        </div>
      )}
    </div>
  )
}
