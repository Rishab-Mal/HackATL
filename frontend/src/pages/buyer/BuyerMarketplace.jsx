import { useEffect, useState, lazy, Suspense, useCallback } from 'react'
import { getLots, getBuyers, getActivity } from '../../api.js'
import { useCart } from '../../context/CartContext.jsx'
import { formatMoney, formatWeightKg } from '../../utils/formatters.js'
import LotDetailModal from '../../components/LotDetailModal.jsx'

const SupplierMap = lazy(() => import('../../components/SupplierMap.jsx'))

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(/[zZ+]|-\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function BuyerMarketplace() {
  const { cart, addToCart, updateQty, removeFromCart, lastSuccess } = useCart()

  const [lots, setLots] = useState([])
  const [buyers, setBuyers] = useState([])
  const [activity, setActivity] = useState([])
  const [filters, setFilters] = useState({ fabric_type: '', color_name: '', min_price: '', max_price: '' })
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [view, setView] = useState('list')
  const [error, setError] = useState(null)
  const [selectedLot, setSelectedLot] = useState(null)

  // Debounce search input 300 ms
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  function refreshLots() {
    getLots({ status: 'available', ...filters, ...(q ? { q } : {}) })
      .then(setLots)
      .catch(e => setError(e.message))
  }

  useEffect(refreshLots, [filters, q])
  useEffect(() => { if (lastSuccess) refreshLots() }, [lastSuccess])

  useEffect(() => {
    getBuyers().then(setBuyers).catch(() => {})
    getActivity().then(setActivity).catch(() => {})
  }, [lastSuccess])

  const fabricTypes = [...new Set(lots.map(l => l.fabric_type))].sort()
  const colors = [...new Set(lots.map(l => l.color_name))].sort()
  const hasFilters = filters.fabric_type || filters.color_name || filters.min_price || filters.max_price

  return (
    <div className="buyer-page">

      {/* ── Carter's pilot banner ─────────────────── */}
      <div className="pilot-banner">
        <span className="pilot-banner-badge">Live Pilot</span>
        <span className="pilot-banner-text">
          Carter's × fibr — 9.5 kg of cotton twill offcuts sorted in &lt;30 s, sold to Looptex Recyclers, $30 revenue from waste.
        </span>
        <span className="pilot-banner-stat">20 kg CO₂ saved · 25,650 L water</span>
      </div>

      {/* ── Page header + search ──────────────────── */}
      <div className="buyer-header-row">
        <div>
          <h1 style={{ marginBottom: 2 }}>Marketplace</h1>
          <p className="subtitle" style={{ margin: 0 }}>AI-sorted textile scrap — graded, priced, and ready to ship.</p>
        </div>
        <div className="search-bar">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            type="text"
            placeholder='Search lots… try "navy cotton" or "polyester"'
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button className="search-clear" onClick={() => { setSearchInput(''); setQ('') }}>✕</button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* ── Filter bar ────────────────────────────── */}
      <div className="buyer-filters">
        <span className="filter-label">Filter:</span>

        <select value={filters.fabric_type} onChange={e => setFilters(f => ({ ...f, fabric_type: e.target.value }))}>
          <option value="">All fabrics</option>
          {fabricTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={filters.color_name} onChange={e => setFilters(f => ({ ...f, color_name: e.target.value }))}>
          <option value="">All colors</option>
          {colors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filters.min_price} onChange={e => setFilters(f => ({ ...f, min_price: e.target.value }))}>
          <option value="">Min price</option>
          {[5, 10, 20, 50, 100].map(p => <option key={p} value={p}>${p}</option>)}
        </select>

        <select value={filters.max_price} onChange={e => setFilters(f => ({ ...f, max_price: e.target.value }))}>
          <option value="">Max price</option>
          {[25, 50, 100, 250, 500].map(p => <option key={p} value={p}>${p}</option>)}
        </select>

        {hasFilters && (
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}
            onClick={() => setFilters({ fabric_type: '', color_name: '', min_price: '', max_price: '' })}>
            Clear
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-muted)' }}>
          {q
            ? <>{lots.length} result{lots.length !== 1 ? 's' : ''} for <em>"{q}"</em></>
            : <>{lots.length} lot{lots.length !== 1 ? 's' : ''} available</>
          }
        </span>

        <div className="view-toggle">
          <button className={`view-toggle-btn${view === 'list' ? ' view-toggle-btn--active' : ''}`} onClick={() => setView('list')}>List</button>
          <button className={`view-toggle-btn${view === 'map' ? ' view-toggle-btn--active' : ''}`} onClick={() => setView('map')}>Map</button>
        </div>
      </div>

      {/* ── Activity strip ────────────────────────── */}
      {activity.length > 0 && view === 'list' && (
        <div className="activity-strip">
          <span className="activity-strip-label">Recent</span>
          <div className="activity-strip-items">
            {activity.slice(0, 8).map(a => (
              <span key={a.lot_id} className="activity-strip-item">
                <span className="activity-dot" />
                <strong>{a.buyer_name}</strong> claimed {a.lot_name}
                <span className="activity-strip-time">{timeAgo(a.claimed_at)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Map view ──────────────────────────────── */}
      {view === 'map' ? (
        <div className="buyer-map-bleed">
          <Suspense fallback={
            <div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-muted)', fontSize: 13 }}>
              Loading map…
            </div>
          }>
            <SupplierMap lots={lots} />
          </Suspense>
        </div>
      ) : (
        <>
          {/* ── Lot grid ──────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {lots.map(lot => {
              const cartItem = cart[lot.id]
              const inCart = !!cartItem
              const qty = cartItem?.qty ?? 0
              const hasDecay = lot.price_decay_pct > 0
              const weightLb = (lot.weight_kg * 2.205).toFixed(1)
              const pricePerLb = (lot.current_price_usd / (lot.weight_kg * 2.205)).toFixed(2)
              const decayProgress = Math.min(lot.price_decay_pct / 65 * 100, 100)
              const isUrgent = lot.price_decay_pct >= 30

              return (
                <div
                  className={`buyer-lot-card${inCart ? ' buyer-lot-card--incart' : ''}`}
                  key={lot.id}
                  onClick={() => setSelectedLot(lot)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="buyer-lot-colorbar" style={{ background: lot.color_hex }}>
                    <span className="buyer-lot-colorbar-label">{lot.color_name}</span>
                    {isUrgent && <span className="buyer-lot-urgent-badge">↓ Price dropping</span>}
                  </div>

                  <div className="buyer-lot-body">
                    <div className="buyer-lot-header-row">
                      <div className="buyer-lot-type">{lot.fabric_type}</div>
                      <div className="buyer-lot-age">{lot.days_listed}d listed</div>
                    </div>
                    <div className="buyer-lot-name">{lot.name}</div>

                    <div className="buyer-lot-price-row">
                      <span className="buyer-lot-price">${lot.current_price_usd.toFixed(2)}</span>
                      {hasDecay && <span className="buyer-lot-discount">−{lot.price_decay_pct}%</span>}
                    </div>

                    <div className="buyer-lot-perlb">
                      ${pricePerLb} / lb &nbsp;·&nbsp; was ${lot.price_usd.toFixed(2)}
                    </div>

                    {/* Price decay bar */}
                    {hasDecay && (
                      <div className="buyer-decay-bar-wrap">
                        <div
                          className="buyer-decay-bar-fill"
                          style={{
                            width: `${decayProgress}%`,
                            background: decayProgress < 50 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                    )}

                    <div className="buyer-lot-meta-row">
                      <span>{weightLb} lb</span>
                      <span>·</span>
                      <span>{lot.piece_count} pcs</span>
                    </div>

                    <div className="buyer-lot-impact">
                      {lot.carbon_saved_kg} kg CO₂ · {(lot.water_saved_l / 1000).toFixed(1)}K L water
                    </div>

                    <div className="buyer-qty-row" onClick={e => e.stopPropagation()}>
                      <span className="buyer-qty-label">
                        {qty > 0 ? `${(qty * 2.205).toFixed(1)} lb` : 'Select qty'}
                      </span>
                      <input
                        type="range" min={0} max={lot.weight_kg} step={0.5} value={qty}
                        className="buyer-slider"
                        onChange={e => {
                          const val = parseFloat(e.target.value)
                          if (inCart) updateQty(lot.id, val)
                          else if (val > 0) addToCart(lot, null, val)
                        }}
                      />
                    </div>

                    <button
                      className={`buyer-lot-cta${inCart ? ' btn-added' : ''}`}
                      onClick={e => {
                        e.stopPropagation()
                        inCart ? removeFromCart(lot.id) : addToCart(lot, null, lot.weight_kg)
                      }}
                    >
                      {inCart ? '✓ In Order' : 'Add to Order'}
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

          {/* Lot detail modal */}
          {selectedLot && (
            <LotDetailModal lot={selectedLot} onClose={() => setSelectedLot(null)} />
          )}

          {/* ── Buyers grid ───────────────────────── */}
          {buyers.length > 0 && (
            <div className="buyers-section">
              <div className="buyers-section-header">
                <div className="buyers-section-title">Who buys on fibr</div>
                <div className="buyers-section-sub">Verified recyclers and makers accepting textile waste</div>
              </div>
              <div className="buyers-grid">
                {buyers.map(b => (
                  <div className="buyer-profile-card" key={b.id}>
                    <div className="buyer-profile-top">
                      <div className="buyer-profile-avatar">
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="buyer-profile-name">{b.name}</div>
                        <div className="buyer-profile-type">{b.type} · {b.location}</div>
                      </div>
                    </div>
                    {b.description && (
                      <p className="buyer-profile-desc">{b.description}</p>
                    )}
                    <div className="buyer-profile-tags">
                      {(Array.isArray(b.interested_materials)
                        ? b.interested_materials
                        : (b.interested_materials || '').split(',').map(s => s.trim()).filter(Boolean)
                      ).map(m => (
                        <span className="buyer-profile-tag" key={m}>{m}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
