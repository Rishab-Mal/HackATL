import { useEffect } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function itemQty({ lot, qty }) {
  return qty != null ? qty : lot.weight_kg
}
function itemPrice({ lot, qty }) {
  const w = Number(lot.weight_kg) || 0
  const p = Number(lot.current_price_usd) || 0
  const q = itemQty({ lot, qty })
  if (!q || q >= w || w <= 0) return p
  return p * (q / w)
}

export default function ImpactCertificate() {
  const { certLots, setCertLots } = useCart()
  const { user } = useAuth()

  useEffect(() => {
    if (!certLots) return
    const onKey = e => { if (e.key === 'Escape') setCertLots(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [certLots, setCertLots])

  if (!certLots) return null

  const totalCarbon = certLots.reduce((s, { lot, qty }) => {
    const ratio = lot.weight_kg > 0 ? itemQty({ lot, qty }) / lot.weight_kg : 1
    return s + (lot.carbon_saved_kg || 0) * ratio
  }, 0)
  const totalWater = certLots.reduce((s, { lot, qty }) => {
    const ratio = lot.weight_kg > 0 ? itemQty({ lot, qty }) / lot.weight_kg : 1
    return s + (lot.water_saved_l || 0) * ratio
  }, 0)
  const totalWeight = certLots.reduce((s, { lot, qty }) => s + itemQty({ lot, qty }), 0)
  const totalSpend  = certLots.reduce((s, item) => s + itemPrice(item), 0)

  const trees   = (totalCarbon / 21).toFixed(1)
  const miles   = Math.round(totalCarbon * 2.48).toLocaleString()
  const showers = Math.round(totalWater / 65).toLocaleString()

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <>
      <div className="modal-overlay" onClick={() => setCertLots(null)} />
      <div className="cert-modal" role="dialog" aria-modal="true">
        <button className="cert-close" onClick={() => setCertLots(null)} aria-label="Close">✕</button>

        {/* Header */}
        <div className="cert-header">
          <div className="cert-logo">fibr</div>
          <div className="cert-badge-row">
            <span className="cert-badge">Circular Textile Certificate</span>
          </div>
          <h2 className="cert-title">Order Confirmed</h2>
          <div className="cert-buyer">{user?.name || 'Buyer'} · {today}</div>
        </div>

        {/* Hero impact numbers */}
        <div className="cert-hero">
          <div className="cert-hero-stat">
            <div className="cert-hero-value cert-hero-value--green">
              {totalCarbon.toFixed(1)} kg
            </div>
            <div className="cert-hero-label">CO₂ prevented</div>
            <div className="cert-hero-equiv">= {trees} trees absorbing CO₂ for a year</div>
          </div>
          <div className="cert-hero-divider" />
          <div className="cert-hero-stat">
            <div className="cert-hero-value cert-hero-value--blue">
              {(totalWater / 1000).toFixed(1)}K L
            </div>
            <div className="cert-hero-label">Water conserved</div>
            <div className="cert-hero-equiv">= {showers} showers</div>
          </div>
          <div className="cert-hero-divider" />
          <div className="cert-hero-stat">
            <div className="cert-hero-value cert-hero-value--violet">
              {totalWeight.toFixed(1)} kg
            </div>
            <div className="cert-hero-label">Fabric diverted</div>
            <div className="cert-hero-equiv">from landfill, not incinerator</div>
          </div>
        </div>

        {/* What it means */}
        <div className="cert-equivs">
          <div className="cert-equiv-row">
            <span className="cert-equiv-icon">🌳</span>
            <span>{trees} trees absorbing CO₂ for a year</span>
          </div>
          <div className="cert-equiv-row">
            <span className="cert-equiv-icon">🚗</span>
            <span>{miles} miles of driving avoided</span>
          </div>
          <div className="cert-equiv-row">
            <span className="cert-equiv-icon">🚿</span>
            <span>{showers} 8-minute showers of water saved</span>
          </div>
        </div>

        {/* Lot list */}
        <div className="cert-lots">
          {certLots.map(({ lot, qty }, i) => {
            const q = itemQty({ lot, qty })
            return (
              <div className="cert-lot-row" key={i}>
                <div className="cert-lot-swatch" style={{ background: lot.color_hex }} />
                <div className="cert-lot-info">
                  <div className="cert-lot-name">{lot.name}</div>
                  <div className="cert-lot-meta">{lot.fabric_type} · {q.toFixed(1)} kg</div>
                </div>
                <div className="cert-lot-price">${itemPrice({ lot, qty }).toFixed(2)}</div>
              </div>
            )
          })}
          <div className="cert-total-row">
            <span>Total invested in circular textiles</span>
            <span className="cert-total-val">${totalSpend.toFixed(2)}</span>
          </div>
        </div>

        {/* SDG badges */}
        <div className="cert-sdg-row">
          <div className="sdg-badge sdg-12">SDG 12<br /><span>Responsible</span></div>
          <div className="sdg-badge sdg-6">SDG 6<br /><span>Water</span></div>
          <div className="sdg-badge sdg-13">SDG 13<br /><span>Climate</span></div>
        </div>

        <div className="cert-footer">
          Carter's × fibr · Atlanta, GA · Make &amp; Remake Pilot 2026
        </div>
      </div>
    </>
  )
}
