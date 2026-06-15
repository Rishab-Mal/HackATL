import { useEffect, useState } from 'react'
import { getLots, delistLot, relistLot } from '../api.js'

export default function SortedLots() {
  const [lots, setLots] = useState([])
  const [filters, setFilters] = useState({ fabric_type: '', color_name: '', status: '' })
  const [error, setError] = useState(null)
  const [acting, setActing] = useState({}) // { [lotId]: true } while request in-flight

  function refresh() {
    const params = {}
    if (filters.fabric_type) params.fabric_type = filters.fabric_type
    if (filters.color_name)  params.color_name  = filters.color_name
    if (filters.status)      params.status       = filters.status
    getLots(params).then(setLots).catch(e => setError(e.message))
  }

  useEffect(refresh, [filters])

  const fabricTypes = [...new Set(lots.map(l => l.fabric_type))].sort()
  const colors      = [...new Set(lots.map(l => l.color_name))].sort()

  async function handleDelist(lotId) {
    setActing(a => ({ ...a, [lotId]: true }))
    try {
      const updated = await delistLot(lotId)
      setLots(prev => prev.map(l => l.id === lotId ? updated : l))
    } catch (e) {
      setError(e.message)
    } finally {
      setActing(a => ({ ...a, [lotId]: false }))
    }
  }

  async function handleRelist(lotId) {
    setActing(a => ({ ...a, [lotId]: true }))
    try {
      const updated = await relistLot(lotId)
      setLots(prev => prev.map(l => l.id === lotId ? updated : l))
    } catch (e) {
      setError(e.message)
    } finally {
      setActing(a => ({ ...a, [lotId]: false }))
    }
  }

  const available = lots.filter(l => l.status === 'available').length
  const unlisted  = lots.filter(l => l.status === 'unlisted').length
  const claimed   = lots.filter(l => l.status === 'claimed').length

  return (
    <div className="buyer-page">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 4 }}>Inventory</h1>
        <p className="subtitle">All lots — available, unlisted, and claimed.</p>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Filter bar */}
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
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
        >
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="unlisted">Unlisted</option>
          <option value="claimed">Claimed</option>
        </select>
        {(filters.fabric_type || filters.color_name || filters.status) && (
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: '5px 10px' }}
            onClick={() => setFilters({ fabric_type: '', color_name: '', status: '' })}
          >
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-muted)' }}>
          {available} available · {unlisted} unlisted · {claimed} claimed
        </span>
      </div>

      {/* Lot grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {lots.map(lot => {
          const hasDecay  = lot.price_decay_pct > 0
          const weightLb  = (lot.weight_kg * 2.205).toFixed(1)
          const pricePerLb = (lot.current_price_usd / (lot.weight_kg * 2.205)).toFixed(2)
          const busy      = !!acting[lot.id]
          const isUnlisted = lot.status === 'unlisted'
          const isClaimed  = lot.status === 'claimed'

          return (
            <div
              className="buyer-lot-card"
              key={lot.id}
              style={isUnlisted ? { opacity: 0.6 } : undefined}
            >
              <div className="buyer-lot-colorbar" style={{ background: lot.color_hex }} />

              <div className="buyer-lot-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div className="buyer-lot-type">{lot.fabric_type}</div>
                  {/* Status pill */}
                  {isClaimed && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 3, padding: '1px 7px', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Claimed
                    </span>
                  )}
                  {isUnlisted && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 3, padding: '1px 7px', color: 'var(--c-danger)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Unlisted
                    </span>
                  )}
                </div>

                <div className="buyer-lot-name">{lot.name}</div>

                <div className="buyer-lot-price">
                  ${lot.current_price_usd.toFixed(2)}
                  {hasDecay && (
                    <span className="buyer-lot-discount">-{lot.price_decay_pct}%</span>
                  )}
                </div>

                <div className="buyer-lot-perlb">
                  ${pricePerLb} / lb &nbsp;·&nbsp; was ${lot.price_usd.toFixed(2)}
                </div>

                <div className="buyer-lot-meta-row">
                  <span>{lot.color_name}</span>
                  <span>·</span>
                  <span>{weightLb} lb</span>
                  <span>·</span>
                  <span>{lot.piece_count} pcs</span>
                  <span>·</span>
                  <span>listed {lot.days_listed}d ago</span>
                </div>

                {/* Impact row */}
                <div style={{ fontSize: 11.5, color: 'var(--c-muted)', marginBottom: 14 }}>
                  {lot.carbon_saved_kg} kg CO₂ saved · {lot.water_saved_l.toLocaleString()} L water
                </div>

                {/* CTA */}
                {isClaimed ? (
                  <div style={{ marginTop: 'auto', padding: '8px 0', fontSize: 12, color: 'var(--c-muted)', borderTop: '1px solid var(--c-border)' }}>
                    Claimed by <strong style={{ color: 'var(--c-text)' }}>{lot.claimed_by}</strong>
                  </div>
                ) : isUnlisted ? (
                  <button
                    className="buyer-lot-cta"
                    style={{ marginTop: 'auto', background: 'var(--c-text)' }}
                    onClick={() => handleRelist(lot.id)}
                    disabled={busy}
                  >
                    {busy ? 'Re-listing…' : 'Re-list on Market'}
                  </button>
                ) : (
                  <button
                    className="buyer-lot-cta"
                    style={{ marginTop: 'auto', background: 'transparent', color: 'var(--c-danger)', border: '1px solid #fecaca' }}
                    onClick={() => handleDelist(lot.id)}
                    disabled={busy}
                  >
                    {busy ? 'Removing…' : 'Remove from Market'}
                  </button>
                )}
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
