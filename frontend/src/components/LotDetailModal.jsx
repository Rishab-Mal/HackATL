import { useEffect } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { formatImpactMass, formatMoney, formatWater, formatWeightKg } from '../utils/formatters.js'

// Demo origin data. Lots are spread across these factories by a stable hash of
// their lot key, so the same lot always traces back to the same origin.
const FACTORIES = [
  { name: "Carter's Atlanta Supplier", city: 'Atlanta, GA', batch: 'Batch #18' },
  { name: "Carter's Braselton Facility", city: 'Braselton, GA', batch: 'Batch #22' },
  { name: 'Fort Payne Textiles', city: 'Fort Payne, AL', batch: 'Batch #07' },
  { name: 'Carolinas Mill Co.', city: 'Charlotte, NC', batch: 'Batch #34' },
]

function factoryFor(lot) {
  const key = String(lot.lot_key || lot.id || '')
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return FACTORIES[h % FACTORIES.length]
}

function DecayBar({ decayPct, daysListed }) {
  const progress = Math.min((decayPct / 65) * 100, 100)
  const color = progress < 30 ? '#22c55e' : progress < 60 ? '#f59e0b' : '#ef4444'
  const daysToFloor = Math.max(0, Math.ceil(Math.log(0.35) / -0.015 + 7 - daysListed))

  return (
    <div className="detail-decay-wrap">
      <div className="detail-decay-header">
        <span className="detail-decay-label">Price over time</span>
        <span className="detail-decay-pct" style={{ color }}>
          {decayPct > 0 ? `${decayPct}% below list` : 'Full price, no decay yet'}
        </span>
      </div>
      <div className="detail-decay-track">
        <div className="detail-decay-fill" style={{ width: `${progress}%`, background: color }} />
      </div>
      {daysToFloor > 0 && decayPct < 65 && (
        <div className="detail-decay-sub">
          Reaches the 35% floor in about {daysToFloor} day{daysToFloor !== 1 ? 's' : ''}
        </div>
      )}
      {decayPct >= 65 && (
        <div className="detail-decay-sub detail-decay-sub--floor">At the floor price, it will not drop further</div>
      )}
    </div>
  )
}

function ImpactRow({ lot }) {
  const showers = Math.round(lot.water_saved_l / 65)

  return (
    <div className="detail-impact-grid">
      <div className="detail-impact-card detail-impact-card--green">
        <div className="detail-impact-val">{formatImpactMass(lot.carbon_saved_kg)}</div>
        <div className="detail-impact-name">CO₂ prevented</div>
        <div className="detail-impact-equiv">vs. making it new</div>
      </div>
      <div className="detail-impact-card detail-impact-card--blue">
        <div className="detail-impact-val">{formatWater(lot.water_saved_l)}</div>
        <div className="detail-impact-name">Water conserved</div>
        <div className="detail-impact-equiv">about {showers.toLocaleString()} showers</div>
      </div>
      <div className="detail-impact-card detail-impact-card--violet">
        <div className="detail-impact-val">{formatWeightKg(lot.weight_kg)}</div>
        <div className="detail-impact-name">Kept from landfill</div>
        <div className="detail-impact-equiv">{(lot.weight_kg * 2.205).toFixed(1)} lb of scrap</div>
      </div>
    </div>
  )
}

export default function LotDetailModal({ lot, onClose }) {
  const { cart, addToCart, removeFromCart } = useCart()
  const inCart = !!cart[lot.id]

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const factory = factoryFor(lot)
  const weightLb = (lot.weight_kg * 2.205).toFixed(1)
  const pricePerLb = lot.weight_kg > 0 ? (lot.current_price_usd / (lot.weight_kg * 2.205)).toFixed(2) : '0.00'

  const rawDate = lot.created_at ? String(lot.created_at) : ''
  const scanDate = rawDate ? new Date(rawDate + (rawDate.endsWith('Z') ? '' : 'Z')) : null
  const scanDateStr = scanDate && !isNaN(scanDate)
    ? scanDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recently'

  return (
    <>
      <div className="lot-modal-overlay" onClick={onClose} />
      <div className="lot-detail-modal" role="dialog" aria-modal="true">

        {/* Header */}
        <div className="detail-header">
          <div className="detail-color-bar" style={{ background: lot.color_hex }} />
          <div className="detail-header-body">
            <div className="detail-eyebrow">{lot.fabric_type} · {lot.color_name}</div>
            <h2 className="detail-title">{lot.name}</h2>
          </div>
          <button className="detail-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="detail-scroll">

          {/* Where it came from */}
          <div className="detail-trace">
            <div className="detail-trace-item">
              <div className="detail-trace-label">Origin</div>
              <div className="detail-trace-val">{factory.name}</div>
              <div className="detail-trace-sub">{factory.city}</div>
            </div>
            <div className="detail-trace-arrow">→</div>
            <div className="detail-trace-item">
              <div className="detail-trace-label">Sorted</div>
              <div className="detail-trace-val">Reweave CV</div>
              <div className="detail-trace-sub">{scanDateStr}</div>
            </div>
            <div className="detail-trace-arrow">→</div>
            <div className="detail-trace-item">
              <div className="detail-trace-label">Listed</div>
              <div className="detail-trace-val">{lot.days_listed}d ago</div>
              <div className="detail-trace-sub">Priced by AI</div>
            </div>
          </div>

          {/* Key specs */}
          <div className="detail-specs">
            <div className="detail-spec">
              <div className="detail-spec-val">{formatWeightKg(lot.weight_kg)}</div>
              <div className="detail-spec-lbl">Weight</div>
            </div>
            <div className="detail-spec">
              <div className="detail-spec-val">{weightLb} lb</div>
              <div className="detail-spec-lbl">Imperial</div>
            </div>
            <div className="detail-spec">
              <div className="detail-spec-val">{lot.piece_count}</div>
              <div className="detail-spec-lbl">Pieces</div>
            </div>
            <div className="detail-spec detail-spec--accent">
              <div className="detail-spec-val">{lot.composition || '—'}</div>
              <div className="detail-spec-lbl">Composition</div>
            </div>
          </div>

          {/* Pricing */}
          <div className="detail-pricing">
            <div className="detail-price-main">
              <span className="detail-price-current">{formatMoney(lot.current_price_usd)}</span>
              {lot.price_decay_pct > 0 && (
                <>
                  <span className="detail-price-was">{formatMoney(lot.price_usd)}</span>
                  <span className="detail-price-badge">−{lot.price_decay_pct}%</span>
                </>
              )}
            </div>
            <div className="detail-price-sub">${pricePerLb}/lb · floor at {formatMoney(lot.price_usd * 0.35)}</div>
            <DecayBar decayPct={lot.price_decay_pct} daysListed={lot.days_listed} />
          </div>

          {/* Environmental impact */}
          <div className="detail-section-label">What this lot saves</div>
          <ImpactRow lot={lot} />

        </div>

        {/* Footer CTA */}
        <div className="detail-footer">
          <button
            className={`detail-cta${inCart ? ' detail-cta--added' : ''}`}
            onClick={() => inCart ? removeFromCart(lot.id) : addToCart(lot, null, lot.weight_kg)}
          >
            {inCart
              ? '✓ In your order, tap to remove'
              : `Add ${formatWeightKg(lot.weight_kg)} to order · ${formatMoney(lot.current_price_usd)}`}
          </button>
        </div>

      </div>
    </>
  )
}
