import { useEffect, useState } from 'react'
import { claimLot, getBuyers, getLots } from '../api.js'

// Person 3 (frontend) owns this screen. Person 4 (marketplace, impact logic,
// demo data) owns buyer profiles and the lot-claiming flow.

export default function Marketplace() {
  const [lots, setLots] = useState([])
  const [buyers, setBuyers] = useState([])
  const [error, setError] = useState(null)
  const [selectedBuyer, setSelectedBuyer] = useState({})

  function refresh() {
    getLots('available').then(setLots).catch((err) => setError(err.message))
    getBuyers().then(setBuyers).catch((err) => setError(err.message))
  }

  useEffect(refresh, [])

  async function handleClaim(lotId) {
    const buyerName = selectedBuyer[lotId]
    if (!buyerName) return
    try {
      await claimLot(lotId, buyerName)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page">
      <h1>Marketplace</h1>
      <p className="subtitle">Recyclers and makers who can claim available scrap lots.</p>

      {error && <div className="error">{error}</div>}

      <h2>Available lots</h2>
      <div className="lot-grid">
        {lots.map((lot) => (
          <div className="lot-card" key={lot.id}>
            <div className="swatch" style={{ background: lot.color_hex }} />
            <div className="lot-info">
              <h3>{lot.name}</h3>
              <p>
                {lot.fabric_type} - {lot.weight_kg} kg - ${lot.price_usd}
              </p>
              <div className="claim-row">
                <select
                  defaultValue=""
                  onChange={(e) => setSelectedBuyer({ ...selectedBuyer, [lot.id]: e.target.value })}
                >
                  <option value="" disabled>
                    Choose buyer
                  </option>
                  {buyers.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => handleClaim(lot.id)}>Claim lot</button>
              </div>
            </div>
          </div>
        ))}
        {lots.length === 0 && !error && <p className="muted">No available lots right now.</p>}
      </div>

      <h2>Recyclers &amp; makers</h2>
      <div className="buyer-grid">
        {buyers.map((b) => (
          <div className="buyer-card" key={b.id}>
            <h3>{b.name}</h3>
            <span className="buyer-type">
              {b.type} - {b.location}
            </span>
            <p>{b.description}</p>
            <div className="tags">
              {b.interested_materials.map((m) => (
                <span className="tag" key={m}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
