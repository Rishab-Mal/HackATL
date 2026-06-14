import { useEffect, useState } from 'react'
import { claimLot, getBuyers, getLotFilterOptions, getLots } from '../api.js'
import LotFilters from '../components/LotFilters.jsx'

// Person 3 (frontend) owns this screen. Person 4 (marketplace, impact logic,
// demo data) owns buyer profiles and the lot-claiming flow.

const EMPTY_FILTERS = { fabric_type: '', color_name: '', min_price: '', max_price: '' }

export default function Marketplace() {
  const [lots, setLots] = useState([])
  const [buyers, setBuyers] = useState([])
  const [options, setOptions] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [error, setError] = useState(null)
  const [selectedBuyer, setSelectedBuyer] = useState({})
  const [claimModal, setClaimModal] = useState(null) // { lot, buyerName, status: 'confirm' | 'sending' | 'done' }

  useEffect(() => {
    getLotFilterOptions().then(setOptions).catch((err) => setError(err.message))
    getBuyers().then(setBuyers).catch((err) => setError(err.message))
  }, [])

  function refreshLots() {
    getLots({ status: 'available', ...filters }).then(setLots).catch((err) => setError(err.message))
  }

  useEffect(refreshLots, [filters])

  function openClaimConfirm(lot) {
    const buyerName = selectedBuyer[lot.id]
    if (!buyerName) return
    setClaimModal({ lot, buyerName, status: 'confirm' })
  }

  async function confirmClaim() {
    if (!claimModal) return
    setClaimModal({ ...claimModal, status: 'sending' })
    try {
      await claimLot(claimModal.lot.id, claimModal.buyerName)
      setClaimModal({ ...claimModal, status: 'done' })
      refreshLots()
    } catch (err) {
      setError(err.message)
      setClaimModal(null)
    }
  }

  function closeClaimModal() {
    setClaimModal(null)
  }

  return (
    <div className="page">
      <h1>Marketplace</h1>
      <p className="subtitle">Recyclers and makers who can claim available scrap lots.</p>

      {error && <div className="error">{error}</div>}

      <h2>Available lots</h2>
      <LotFilters options={options} filters={filters} onChange={setFilters} />

      <p className="muted result-count">
        {lots.length} lot{lots.length === 1 ? '' : 's'} available
      </p>

      <div className="lot-grid">
        {lots.map((lot) => (
          <div className="lot-card" key={lot.id}>
            <div className="swatch" style={{ background: lot.color_hex }} />
            <div className="lot-info">
              <h3>{lot.name}</h3>
              <p>
                {lot.fabric_type} - {lot.weight_kg} kg - ${lot.price_usd}
              </p>
              {lot.description && <p className="lot-description">{lot.description}</p>}
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
                <button onClick={() => openClaimConfirm(lot)} disabled={!selectedBuyer[lot.id]}>
                  Claim lot
                </button>
              </div>
            </div>
          </div>
        ))}
        {lots.length === 0 && !error && <p className="muted">No available lots match these filters.</p>}
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

      {claimModal && (
        <div className="modal-overlay" onClick={closeClaimModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {claimModal.status === 'done' ? (
              <>
                <p className="modal-success">Request sent to {claimModal.buyerName} ✓</p>
                <div className="modal-actions">
                  <button onClick={closeClaimModal}>Done</button>
                </div>
              </>
            ) : (
              <>
                <h3>Confirm claim</h3>
                <p>
                  Send a claim request for <strong>{claimModal.lot.name}</strong> to{' '}
                  <strong>{claimModal.buyerName}</strong>?
                </p>
                <div className="modal-actions">
                  <button type="button" onClick={closeClaimModal} disabled={claimModal.status === 'sending'}>
                    Cancel
                  </button>
                  <button onClick={confirmClaim} disabled={claimModal.status === 'sending'}>
                    {claimModal.status === 'sending' ? 'Sending...' : 'Confirm'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
