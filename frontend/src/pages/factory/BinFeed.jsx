import { useEffect, useState, useRef } from 'react'
import { getLots } from '../../api.js'

const BINS = [
  { id: 'A', label: 'Bin A', desc: 'White & Natural', colors: ['white', 'natural', 'cream', 'ivory'], bg: '#f8f6f0', border: '#d4c9a8' },
  { id: 'B', label: 'Bin B', desc: 'Blue & Denim',    colors: ['blue', 'navy', 'denim', 'indigo'],  bg: '#eef2fb', border: '#8fa8e0' },
  { id: 'C', label: 'Bin C', desc: 'Neutral Darks',   colors: ['black', 'grey', 'gray', 'charcoal'], bg: '#f0f0f0', border: '#a0a0a0' },
  { id: 'D', label: 'Bin D', desc: 'Earth & Warm',    colors: ['beige', 'brown', 'tan', 'red', 'orange'], bg: '#fdf5ec', border: '#d4a96a' },
  { id: 'E', label: 'Bin E', desc: 'Mixed & Other',   colors: [],                                    bg: '#f4f5f7', border: '#c5cad4' },
]

function assignBin(colorName) {
  const c = colorName.toLowerCase()
  for (const bin of BINS) {
    if (bin.colors.includes(c)) return bin
  }
  return BINS[4]
}

export default function BinFeed() {
  const [lots, setLots] = useState([])
  const [idx, setIdx] = useState(0)
  const [flash, setFlash] = useState(false)
  const [binCounts, setBinCounts] = useState({ A: 0, B: 0, C: 0, D: 0, E: 0 })
  const intervalRef = useRef(null)

  useEffect(() => {
    getLots().then(data => setLots(data.filter(l => l.status === 'available')))
  }, [])

  useEffect(() => {
    if (lots.length === 0) return
    intervalRef.current = setInterval(() => {
      setIdx(i => {
        const next = (i + 1) % lots.length
        const bin = assignBin(lots[next]?.color_name || '')
        setBinCounts(prev => ({ ...prev, [bin.id]: (prev[bin.id] || 0) + 1 }))
        setFlash(true)
        setTimeout(() => setFlash(false), 400)
        return next
      })
    }, 3000)
    return () => clearInterval(intervalRef.current)
  }, [lots])

  const current = lots[idx]
  const currentBin = current ? assignBin(current.color_name) : null

  return (
    <div className="binfeed">
      <h1 className="binfeed-title">Live Bin Assignment</h1>
      <p className="subtitle">Pieces detected by camera — place each in the indicated bin.</p>

      {current ? (
        <div className={`binfeed-current ${flash ? 'binfeed-flash' : ''}`}>
          <div className="binfeed-piece">
            <div className="binfeed-swatch" style={{ background: current.color_hex }} />
            <div>
              <div className="binfeed-piece-name">{current.color_name.toUpperCase()} · {current.fabric_type}</div>
              <div className="binfeed-piece-meta">{current.composition} · {current.piece_count} pieces</div>
            </div>
          </div>
          <div className="binfeed-arrow">→</div>
          <div className="binfeed-bin-target" style={{ background: currentBin.bg, borderColor: currentBin.border }}>
            <div className="binfeed-bin-id">{currentBin.label}</div>
            <div className="binfeed-bin-desc">{currentBin.desc}</div>
          </div>
        </div>
      ) : (
        <div className="binfeed-waiting">Waiting for camera feed…</div>
      )}

      <div className="binfeed-bins">
        {BINS.map(bin => (
          <div
            key={bin.id}
            className={`binfeed-bin-card ${currentBin?.id === bin.id && flash ? 'binfeed-bin-active' : ''}`}
            style={{ background: bin.bg, borderColor: bin.border }}
          >
            <div className="binfeed-bin-card-id">{bin.label}</div>
            <div className="binfeed-bin-card-desc">{bin.desc}</div>
            <div className="binfeed-bin-card-count">{binCounts[bin.id] || 0} pieces</div>
          </div>
        ))}
      </div>

      <div className="binfeed-log">
        <h3>Recent assignments</h3>
        <div className="binfeed-log-list">
          {lots.slice(0, idx + 1).reverse().slice(0, 8).map((lot, i) => {
            const bin = assignBin(lot.color_name)
            return (
              <div key={i} className="binfeed-log-row">
                <div className="binfeed-log-swatch" style={{ background: lot.color_hex }} />
                <span>{lot.color_name} {lot.fabric_type}</span>
                <span className="binfeed-log-bin" style={{ background: bin.bg, borderColor: bin.border }}>
                  {bin.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
