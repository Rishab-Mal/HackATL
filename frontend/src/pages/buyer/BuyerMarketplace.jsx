import { useEffect, useMemo, useState } from 'react'
import { getLots } from '../../api.js'
import { useCart } from '../../context/CartContext.jsx'
import { formatInputKg, formatMoney, formatUnitPrice, formatWeightKg, lotQuantityStep } from '../../utils/formatters.js'

export default function BuyerMarketplace() {
  const { cart, addToCart, updateQty, removeFromCart } = useCart()

  const [lots, setLots] = useState([])
  const [filters, setFilters] = useState({ fabric_type: '', color_name: '', query: '', sort: 'newest' })
  const [draftQty, setDraftQty] = useState({})
  const [imageIndex, setImageIndex] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  function refresh() {
    setLoading(true)
    getLots({ status: 'available' })
      .then((data) => {
        setLots(data)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    window.addEventListener('lots:changed', refresh)
    return () => window.removeEventListener('lots:changed', refresh)
  }, [])

  const groupedLots = useMemo(() => groupLots(lots), [lots])
  const fabricTypes = useMemo(() => [...new Set(groupedLots.map(l => l.fabric_type))].sort(), [groupedLots])
  const colors = useMemo(() => [...new Set(groupedLots.map(l => l.color_name))].sort(), [groupedLots])

  const visibleLots = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    return groupedLots
      .filter((lot) => !filters.fabric_type || lot.fabric_type === filters.fabric_type)
      .filter((lot) => !filters.color_name || lot.color_name === filters.color_name)
      .filter((lot) => {
        if (!query) return true
        return [lot.name, lot.fabric_type, lot.composition, lot.color_name, lot.description]
          .some((value) => String(value || '').toLowerCase().includes(query))
      })
      .sort((a, b) => {
        if (filters.sort === 'price-low') return a.current_price_usd - b.current_price_usd
        if (filters.sort === 'price-high') return b.current_price_usd - a.current_price_usd
        if (filters.sort === 'weight-high') return b.weight_kg - a.weight_kg
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [filters, groupedLots])

  function selectedQty(lot) {
    return cart[lot.id]?.qty ?? draftQty[lot.id] ?? defaultQty(lot.weight_kg)
  }

  function setQty(lot, value) {
    const next = clampQty(Number(value), lot.weight_kg)
    setDraftQty((prev) => ({ ...prev, [lot.id]: next }))
    if (cart[lot.id]) {
      if (next > 0) updateQty(lot.id, next)
      else removeFromCart(lot.id)
    }
  }

  function addSelected(lot) {
    const qty = selectedQty(lot)
    if (qty <= 0) return
    addToCart(lot, null, qty)
  }

  function cycleImage(lotId, count, direction) {
    if (count <= 1) return
    setImageIndex((prev) => {
      const current = prev[lotId] || 0
      return { ...prev, [lotId]: (current + direction + count) % count }
    })
  }

  const hasFilters = filters.fabric_type || filters.color_name || filters.query

  return (
    <div className="buyer-page">
      <div className="buyer-hero">
        <div>
          <h1>Available Lots</h1>
          <p className="subtitle">Grouped textile scrap inventory from factory scans, ready for quantity-based orders.</p>
        </div>
        <div className="buyer-hero-stats">
          <strong>{visibleLots.length}</strong>
          <span>{visibleLots.length === 1 ? 'listing' : 'listings'}</span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="buyer-toolbar">
        <label className="buyer-search">
          <IconSearch />
          <input
            value={filters.query}
            onChange={e => setFilters(f => ({ ...f, query: e.target.value }))}
            placeholder="Search fabric, color, composition"
          />
        </label>

        <select
          value={filters.fabric_type}
          onChange={e => setFilters(f => ({ ...f, fabric_type: e.target.value }))}
        >
          <option value="">All fabrics</option>
          {fabricTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filters.color_name}
          onChange={e => setFilters(f => ({ ...f, color_name: e.target.value }))}
        >
          <option value="">All colors</option>
          {colors.map(c => <option key={c} value={c}>{capitalize(c)}</option>)}
        </select>

        <select
          value={filters.sort}
          onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
        >
          <option value="newest">Newest first</option>
          <option value="weight-high">Most material</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
        </select>

        {hasFilters && (
          <button
            className="btn-ghost"
            onClick={() => setFilters({ fabric_type: '', color_name: '', query: '', sort: 'newest' })}
          >
            Clear
          </button>
        )}
      </div>

      <div className="buyer-lot-grid">
        {visibleLots.map(lot => {
          const cartItem = cart[lot.id]
          const inCart = !!cartItem
          const qty = selectedQty(lot)
          const selectedPrice = proratedPrice(lot, qty)
          const images = normalizePieceImages(lot.piece_images)
          const activeImage = imageIndex[lot.id] || 0
          const hasDecay = lot.price_decay_pct > 0
          const perKg = lot.weight_kg > 0 ? lot.current_price_usd / lot.weight_kg : 0
          const step = lotQuantityStep(lot.weight_kg)
          const gramScale = lot.weight_kg < 1
          const inputStep = gramScale ? step * 1000 : step
          const inputMax = gramScale ? lot.weight_kg * 1000 : lot.weight_kg
          const inputValue = gramScale ? formatInputGrams(qty) : formatInputKg(qty)

          return (
            <article className="buyer-lot-card" key={lot.id}>
              <div className="buyer-lot-media">
                {images.length ? (
                  <>
                    <img src={images[activeImage]?.src} alt={`${lot.name} fabric piece ${activeImage + 1}`} />
                    {images.length > 1 && (
                      <div className="buyer-media-controls">
                        <button type="button" onClick={() => cycleImage(lot.id, images.length, -1)} aria-label="Previous image">
                          <IconChevronLeft />
                        </button>
                        <span>{activeImage + 1} / {images.length}</span>
                        <button type="button" onClick={() => cycleImage(lot.id, images.length, 1)} aria-label="Next image">
                          <IconChevronRight />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="buyer-lot-fallback" style={{ background: lot.color_hex }}>
                    <span>{capitalize(lot.color_name)}</span>
                  </div>
                )}
              </div>

              <div className="buyer-lot-body">
                <div className="buyer-card-topline">
                  <span className="buyer-lot-type">{lot.fabric_type}</span>
                  {lot.source_count > 1 && <span className="buyer-merged-badge">{lot.source_count} scans merged</span>}
                </div>

                <div className="buyer-lot-name">{lot.name}</div>

                <div className="buyer-lot-meta-row">
                  <span className="buyer-swatch-dot" style={{ background: lot.color_hex }} />
                  <span>{capitalize(lot.color_name)}</span>
                  <span>{formatWeightKg(lot.weight_kg)}</span>
                  <span>{lot.piece_count} pcs</span>
                </div>

                <div className="buyer-price-row">
                  <div>
                    <div className="buyer-lot-price">{formatMoney(selectedPrice)}</div>
                    <div className="buyer-lot-perlb">
                      {formatUnitPrice(perKg)}
                      {hasDecay && <span> · {lot.price_decay_pct}% below list</span>}
                    </div>
                  </div>
                  <div className="buyer-weight-total">
                    <strong>{formatWeightKg(qty)}</strong>
                    <span>selected</span>
                  </div>
                </div>

                <div className="buyer-qty-row">
                  <input
                    type="range"
                    min={0}
                    max={lot.weight_kg}
                    step={step}
                    value={qty}
                    onChange={e => setQty(lot, e.target.value)}
                    className="buyer-slider"
                  />
                  <input
                    type="number"
                    min={0}
                    max={inputMax}
                    step={inputStep}
                    value={inputValue}
                    onChange={e => setQty(lot, gramScale ? Number(e.target.value) / 1000 : e.target.value)}
                    className="buyer-qty-input"
                    aria-label={`Quantity in ${gramScale ? 'grams' : 'kilograms'} for ${lot.name}`}
                  />
                  <span className="buyer-qty-unit">{gramScale ? 'g' : 'kg'}</span>
                </div>

                <button
                  className={`buyer-lot-cta${inCart ? ' btn-added' : ''}`}
                  onClick={() => inCart ? removeFromCart(lot.id) : addSelected(lot)}
                  disabled={!inCart && qty <= 0}
                >
                  {inCart ? 'Remove from order' : 'Add selected'}
                </button>
              </div>
            </article>
          )
        })}
        {!loading && visibleLots.length === 0 && (
          <div className="buyer-empty">
            <h2>No matching lots</h2>
            <p className="muted">Try clearing the search or filters.</p>
          </div>
        )}
        {loading && (
          <div className="buyer-empty">
            <h2>Loading lots</h2>
            <p className="muted">Checking current factory inventory.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function groupLots(lots) {
  const groups = new Map()
  for (const lot of lots) {
    const key = lot.lot_key || makeLotKey(lot.fabric_type, lot.composition, lot.color_name)
    const existing = groups.get(key)
    const images = normalizePieceImages(lot.piece_images)
    if (!existing) {
      groups.set(key, {
        ...lot,
        id: `group:${key}`,
        lot_key: key,
        component_lots: [lot],
        source_count: 1,
        piece_images: images,
      })
      continue
    }

    existing.component_lots.push(lot)
    existing.source_count += 1
    existing.weight_kg = Number((existing.weight_kg + lot.weight_kg).toFixed(3))
    existing.piece_count += lot.piece_count
    existing.price_usd = Number((existing.price_usd + lot.price_usd).toFixed(2))
    existing.current_price_usd = Number((existing.current_price_usd + lot.current_price_usd).toFixed(2))
    existing.piece_images = [...existing.piece_images, ...images].slice(0, 24)
    if (new Date(lot.created_at) > new Date(existing.created_at)) existing.created_at = lot.created_at
    existing.days_listed = Math.min(existing.days_listed, lot.days_listed)
  }

  return [...groups.values()].map((lot) => ({
    ...lot,
    component_lots: lot.component_lots.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  }))
}

function normalizePieceImages(images) {
  if (!Array.isArray(images)) return []
  return images
    .map((img) => {
      if (typeof img === 'string') return { src: img }
      if (img && typeof img === 'object') {
        const src = img.src || img.url || img.crop_data_url || img.data_url
        if (src) return { ...img, src }
      }
      return null
    })
    .filter(Boolean)
}

function defaultQty(weightKg) {
  const weight = Number(weightKg) || 0
  if (weight <= 0) return 0
  if (weight <= 0.25) return weight
  return Number(Math.min(weight, Math.max(0.1, weight * 0.5)).toFixed(3))
}

function clampQty(value, max) {
  const maximum = Number(max) || 0
  if (!Number.isFinite(value)) return 0
  return Number(Math.min(Math.max(value, 0), maximum).toFixed(3))
}

function proratedPrice(lot, qty) {
  const weight = Number(lot.weight_kg) || 0
  const price = Number(lot.current_price_usd) || 0
  const selected = Number(qty) || 0
  if (weight <= 0 || selected >= weight) return price
  return Number((price * (selected / weight)).toFixed(4))
}

function formatInputGrams(kg) {
  const grams = (Number(kg) || 0) * 1000
  return grams < 10 ? grams.toFixed(1).replace(/\.?0+$/, '') : String(Math.round(grams))
}

function makeLotKey(fabricType, composition, colorName) {
  return [fabricType, composition, colorName]
    .map((part) => String(part || 'unspecified').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unspecified')
    .join('::')
}

function capitalize(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
