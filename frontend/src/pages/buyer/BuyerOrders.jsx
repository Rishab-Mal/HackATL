import { useEffect, useState } from 'react'
import { getLots } from '../../api.js'
import { useAuth } from '../../context/AuthContext.jsx'

const CARBON_PER_KG = 2.1
const WATER_PER_KG  = 2700
const ENERGY_PER_KG = 15

function fmt$(v) { return '$' + Number(v).toFixed(2) }
function fmtKg(v) { return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` }
function fmtDate(iso) {
  return new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const CARBON_EQUIVS = [
  { threshold: 21, label: v => `${(v / 21).toFixed(1)} trees absorbing CO₂ for a year` },
  { threshold: 0,  label: v => `${(v * 2.48).toFixed(0)} miles of driving avoided` },
]

function ImpactCert({ orders }) {
  const totalCarbon = orders.reduce((s, o) => s + (o.carbon_saved_kg || 0), 0)
  const totalWater  = orders.reduce((s, o) => s + (o.water_saved_l  || 0), 0)
  const totalWeight = orders.reduce((s, o) => s + (o.weight_kg       || 0), 0)
  const totalSpend  = orders.reduce((s, o) => s + (o.price_usd       || 0), 0)

  if (totalCarbon === 0) return null

  const trees    = (totalCarbon / 21).toFixed(1)
  const miles    = (totalCarbon * 2.48).toFixed(0)
  const showers  = (totalWater / 65).toFixed(0)
  const bottles  = (totalWater / 0.5).toFixed(0)

  return (
    <div className="orders-cert">
      <div className="orders-cert-header">
        <div className="orders-cert-eyebrow">Your Environmental Impact</div>
        <div className="orders-cert-title">You've diverted {fmtKg(totalWeight)} of textile waste</div>
      </div>
      <div className="orders-cert-stats">
        <div className="orders-cert-stat">
          <div className="orders-cert-value">{fmtKg(totalCarbon)}</div>
          <div className="orders-cert-label">CO₂ prevented</div>
          <div className="orders-cert-equiv">= {trees} trees absorbing CO₂ for a year</div>
        </div>
        <div className="orders-cert-divider" />
        <div className="orders-cert-stat">
          <div className="orders-cert-value">{(totalWater / 1000).toFixed(1)}K L</div>
          <div className="orders-cert-label">Water conserved</div>
          <div className="orders-cert-equiv">= {Number(showers).toLocaleString()} showers saved</div>
        </div>
        <div className="orders-cert-divider" />
        <div className="orders-cert-stat">
          <div className="orders-cert-value">{fmtKg(totalWeight)}</div>
          <div className="orders-cert-label">Fabric diverted</div>
          <div className="orders-cert-equiv">from landfill via fibr</div>
        </div>
        <div className="orders-cert-divider" />
        <div className="orders-cert-stat">
          <div className="orders-cert-value">{fmt$(totalSpend)}</div>
          <div className="orders-cert-label">Total invested</div>
          <div className="orders-cert-equiv">in circular textiles</div>
        </div>
      </div>
      <div className="orders-cert-sdg-row">
        <div className="sdg-badge sdg-12">SDG 12<br /><span>Responsible</span></div>
        <div className="sdg-badge sdg-6">SDG 6<br /><span>Water</span></div>
        <div className="sdg-badge sdg-13">SDG 13<br /><span>Climate</span></div>
      </div>
    </div>
  )
}

export default function BuyerOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.name) return
    getLots({ status: 'claimed', claimed_by: user.name })
      .then(data => { setOrders(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [user?.name])

  if (loading) return (
    <div className="buyer-page">
      <div className="dash-loading"><div className="dash-spinner" />Loading orders…</div>
    </div>
  )
  if (error) return (
    <div className="buyer-page">
      <div className="error">{error}</div>
    </div>
  )

  return (
    <div className="buyer-page">
      <div className="orders-header">
        <div>
          <h1 style={{ marginBottom: 2 }}>My Orders</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {orders.length} lot{orders.length !== 1 ? 's' : ''} claimed — circular textile supply
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="orders-empty">
          <div className="orders-empty-icon">○</div>
          <div className="orders-empty-title">No orders yet</div>
          <div className="orders-empty-sub">
            Head to the Marketplace to browse available textile lots.
          </div>
          <a href="/buyer" className="btn-primary" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none', padding: '10px 20px', background: 'var(--c-accent)', color: '#fff', borderRadius: 'var(--r)' }}>
            Browse Marketplace →
          </a>
        </div>
      ) : (
        <>
          <ImpactCert orders={orders} />

          <div className="orders-list">
            {orders.sort((a, b) => new Date(b.claimed_at) - new Date(a.claimed_at)).map(order => {
              const weightLb = (order.weight_kg * 2.205).toFixed(1)
              return (
                <div className="order-card" key={order.id}>
                  <div className="order-card-swatch" style={{ background: order.color_hex }} />
                  <div className="order-card-body">
                    <div className="order-card-top">
                      <div>
                        <div className="order-card-name">{order.name}</div>
                        <div className="order-card-meta">
                          {order.fabric_type} · {order.color_name} · {order.composition}
                        </div>
                      </div>
                      <div className="order-card-price">{fmt$(order.price_usd)}</div>
                    </div>

                    <div className="order-card-stats">
                      <div className="order-stat">
                        <span className="order-stat-val">{order.weight_kg} kg</span>
                        <span className="order-stat-lbl">weight</span>
                      </div>
                      <div className="order-stat">
                        <span className="order-stat-val">{weightLb} lb</span>
                        <span className="order-stat-lbl">imperial</span>
                      </div>
                      <div className="order-stat">
                        <span className="order-stat-val">{order.piece_count} pcs</span>
                        <span className="order-stat-lbl">pieces</span>
                      </div>
                      <div className="order-stat order-stat--green">
                        <span className="order-stat-val">{order.carbon_saved_kg} kg</span>
                        <span className="order-stat-lbl">CO₂ saved</span>
                      </div>
                      <div className="order-stat order-stat--blue">
                        <span className="order-stat-val">{(order.water_saved_l / 1000).toFixed(1)}K L</span>
                        <span className="order-stat-lbl">water saved</span>
                      </div>
                    </div>

                    <div className="order-card-footer">
                      <span className="order-card-date">
                        Claimed {order.claimed_at ? fmtDate(order.claimed_at) : 'recently'}
                      </span>
                      <span className="order-card-origin">
                        Carter's Circular Supply Pilot · Atlanta, GA
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
