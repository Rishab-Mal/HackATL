import { useEffect } from 'react'
import { useCart } from '../context/CartContext.jsx'

// Factory origin data — keyed by lot id % 4 to match SupplierMap assignment
const FACTORIES = [
  { name: "Carter's Atlanta Supplier",   city: "Atlanta, GA",        batch: "Batch #18" },
  { name: "Carter's Braselton Facility", city: "Braselton, GA",      batch: "Batch #22" },
  { name: "Fort Payne Textiles",         city: "Fort Payne, AL",     batch: "Batch #07" },
  { name: "Carolinas Mill Co.",          city: "Charlotte, NC",       batch: "Batch #34" },
]

function DecayBar({ decayPct, daysListed }) {
  // 0% decay = full price (green), 65% decay = floor price (red)
  const progress = Math.min(decayPct / 65 * 100, 100)
  const color = progress < 30 ? '#22c55e' : progress < 60 ? '#f59e0b' : '#ef4444'
  const daysToFloor = Math.max(0, Math.ceil((Math.log(0.35) / -0.015) + 7 - daysListed))

  return (
    <div className="detail-decay-wrap">
      <div className="detail-decay-header">
        <span className="detail-decay-label">Price decay</span>
        <span className="detail-decay-pct" style={{ color }}>
          {decayPct > 0 ? `−${decayPct}% from base` : 'Full price — no decay yet'}
        </span>
      </div>
      <div className="detail-decay-track">
        <div className="detail-decay-fill" style={{ width: `${progress}%`, background: color }} />
      </div>
      {daysToFloor > 0 && decayPct < 65 && (
        <div className="detail-decay-sub">
          Price floor (35%) reached in ~{daysToFloor} day{daysToFloor !== 1 ? 's' : ''}
        </div>
      )}
      {decayPct >= 65 && (
        <div className="detail-decay-sub detail-decay-sub--floor">Floor price reached — won't go lower</div>
      )}
    </div>
  )
}

function ImpactRow({ lot }) {
  const trees   = (lot.carbon_saved_kg / 21).toFixed(1)
  const miles   = (lot.carbon_saved_kg * 2.48).toFixed(0)
  const showers = Math.round(lot.water_saved_l / 65)

  return (
    <div className="detail-impact-grid">
      <div className="detail-impact-card detail-impact-card--green">
        <div className="detail-impact-val">{lot.carbon_saved_kg} kg</div>
        <div className="detail-impact-name">CO₂ prevented</div>
        <div className="detail-impact-equiv">= {trees} trees · {miles} miles of driving</div>
      </div>
      <div className="detail-impact-card detail-impact-card--blue">
        <div className="detail-impact-val">{(lot.water_saved_l / 1000).toFixed(1)}K L</div>
        <div className="detail-impact-name">Water conserved</div>
        <div className="detail-impact-equiv">= {showers.toLocaleString()} showers saved</div>
      </div>
      <div className="detail-impact-card detail-impact-card--violet">
        <div className="detail-impact-val">{lot.weight_kg} kg</div>
        <div className="detail-impact-name">Diverted from landfill</div>
        <div className="detail-impact-equiv">= {(lot.weight_kg * 2.205).toFixed(1)} lb of textile waste</div>
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

  const factory  = FACTORIES[lot.id % 4]
  const pricePerLb = (lot.current_price_usd / (lot.weight_kg * 2.205)).toFixed(2)
  const weightLb   = (lot.weight_kg * 2.205).toFixed(1)

  const scanDate = new Date(lot.created_at + (lot.created_at.endsWith('Z') ? '' : 'Z'))
  const scanDateStr = scanDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
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

          {/* Traceability strip */}
          <div className="detail-trace">
            <div className="detail-trace-item">
              <div className="detail-trace-label">Origin</div>
              <div className="detail-trace-val">{factory.name}</div>
              <div className="detail-trace-sub">{factory.city}</div>
            </div>
            <div className="detail-trace-arrow">→</div>
            <div className="detail-trace-item">
              <div className="detail-trace-label">Batch</div>
              <div className="detail-trace-val">{factory.batch}</div>
              <div className="detail-trace-sub">Production run</div>
            </div>
            <div className="detail-trace-arrow">→</div>
            <div className="detail-trace-item">
              <div className="detail-trace-label">Sorted by CV</div>
              <div className="detail-trace-val">fibr</div>
              <div className="detail-trace-sub">{scanDateStr}</div>
            </div>
            <div className="detail-trace-arrow">→</div>
            <div className="detail-trace-item">
              <div className="detail-trace-label">Listed</div>
              <div className="detail-trace-val">{lot.days_listed}d ago</div>
              <div className="detail-trace-sub">Auto-priced by AI</div>
            </div>
          </div>

          {/* Key specs */}
          <div className="detail-specs">
            <div className="detail-spec">
              <div className="detail-spec-val">{lot.weight_kg} kg</div>
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
              <span className="detail-price-current">${lot.current_price_usd.toFixed(2)}</span>
              {lot.price_decay_pct > 0 && (
                <>
                  <span className="detail-price-was">${lot.price_usd.toFixed(2)}</span>
                  <span className="detail-price-badge">−{lot.price_decay_pct}%</span>
                </>
              )}
            </div>
            <div className="detail-price-sub">${pricePerLb}/lb · floor at ${(lot.price_usd * 0.35).toFixed(2)}</div>
            <DecayBar decayPct={lot.price_decay_pct} daysListed={lot.days_listed} />
          </div>

          {/* Environmental impact */}
          <div className="detail-section-label">Environmental Impact</div>
          <ImpactRow lot={lot} />

          {/* Carter's pilot note */}
          <div className="detail-pilot-note">
            <span className="detail-pilot-badge">Live Pilot</span>
            This lot originated from Carter's circular supply pilot. Buying it contributes directly
            to the Carter's × fibr textile waste reduction program.
          </div>

        </div>

        {/* Footer CTA */}
        <div className="detail-footer">
          <button
            className={`detail-cta${inCart ? ' detail-cta--added' : ''}`}
            onClick={() => inCart ? removeFromCart(lot.id) : addToCart(lot, null, lot.weight_kg)}
          >
            {inCart ? '✓ In Order — Remove' : `Add ${lot.weight_kg} kg to Order · $${lot.current_price_usd.toFixed(2)}`}
          </button>
        </div>

      </div>
    </>
  )
}
