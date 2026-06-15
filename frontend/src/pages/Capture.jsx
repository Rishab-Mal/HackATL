import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createLot, detectScrap, resetDemoData } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ReweaveLogo } from '../components/ReweaveMark.jsx'

// Factory worker scanning flow. Person 1 (vision) owns the /api/vision/detect
// response shape this screen renders -- see backend/app/schemas.py:
// DetectResponse / Piece / ColorGroup. The full response is kept in state even
// though most fields are not shown, so the admin side can use them later.

const STATUS_LINES = [
  'Checking photo',
  'Finding scrap edges',
  'Grouping colors',
  'Estimating pieces',
  'Preparing pack list',
]

export default function Capture() {
  const [stage, setStage] = useState('start') // start | capture | processing | plan | listed | error
  const [previewUrl, setPreviewUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [packed, setPacked] = useState(() => new Set())
  const [finishedBatch, setFinishedBatch] = useState(null)
  const [statusIdx, setStatusIdx] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)

  const autoSavedRef = useRef(false)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)

  // Cycle the status readout while we wait on the detect call.
  useEffect(() => {
    if (stage !== 'processing') return
    setStatusIdx(0)
    const timer = setInterval(() => {
      setStatusIdx((i) => (i + 1) % STATUS_LINES.length)
    }, 1500)
    return () => clearInterval(timer)
  }, [stage])

  function startScan(e) {
    const selected = e.target.files && e.target.files[0]
    e.target.value = '' // allow re-picking the same file later
    if (!selected) return

    autoSavedRef.current = false
    setError(null)
    setResult(null)
    setPacked(new Set())
    setFinishedBatch(null)
    setZoomOpen(false)
    setPreviewUrl(URL.createObjectURL(selected))
    setStage('processing')

    detectScrap(selected)
      .then((res) => {
        setResult(res)
        autoSaveLots(res)
        setStage('plan')
      })
      .catch((err) => {
        setError(friendlyError(err))
        setStage('error')
      })
  }

  // Silently turn each detected color group into a marketplace lot. Invisible to
  // the worker -- it just makes scanned materials available to buyers right away.
  // One failure never blocks the others or the UI, so an un-wired database is safe.
  function autoSaveLots(res) {
    if (autoSavedRef.current) return
    autoSavedRef.current = true
    const groups = (res && res.groups) || []
    if (groups.length === 0) return
    Promise.allSettled(groups.map((g) => createLot(buildLotPayload(g)))).then((results) => {
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length) console.warn('Some lots could not be listed:', failed)
      })
  }

  function finishBatch() {
    const summary = buildListingSummary(result)
    setFinishedBatch(summary)
    setStage('listed')
  }

  function togglePacked(key) {
    setPacked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function reset(nextStage = 'start') {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    autoSavedRef.current = false
    setPreviewUrl(null)
    setResult(null)
    setError(null)
    setPacked(new Set())
    setFinishedBatch(null)
    setZoomOpen(false)
    setStage(nextStage)
  }

  // Fallback only: if the backend did not return a rendered plan image, draw the
  // piece bounding boxes over the worker's own photo so they still get an
  // annotated view. Scales each bbox from the original image to the display size.
  useEffect(() => {
    if (stage !== 'plan') return
    if (!result || result.annotated_image_data_url) return
    if (!imgRef.current || !canvasRef.current) return
    const img = imgRef.current
    const canvas = canvasRef.current

    function draw() {
      canvas.width = img.clientWidth
      canvas.height = img.clientHeight
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const scaleX = canvas.width / result.image_width
      const scaleY = canvas.height / result.image_height
      result.pieces.forEach((piece) => {
        const [x, y, w, h] = piece.bbox
        ctx.strokeStyle = piece.outline_color || piece.color_hex
        ctx.lineWidth = 3
        ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY)
      })
    }

    if (img.complete) draw()
    else img.onload = draw
  }, [stage, result])

  const groups = result ? [...result.groups].sort(sortByBin) : []
  const annotated = result && result.annotated_image_data_url

  let body
  if (stage === 'start') {
    body = (
      <section className="fx-stage fx-start">
        <div className="fx-start-sheet">
          <div className="fx-start-content">
            <div className="fx-start-head">
              <span className="fx-eyebrow">Factory station</span>
              <h1 className="fx-title">Start a table scan</h1>
              <p className="fx-lead">
                Take one clear photo of the work table. The next screen will turn it into boxes to
                pack, then mark the finished batch as listed.
              </p>
            </div>

            <div className="fx-table-guide" aria-hidden="true">
              <div className="fx-table-surface">
                <span className="fx-scrap fx-scrap--one" />
                <span className="fx-scrap fx-scrap--two" />
                <span className="fx-scrap fx-scrap--three" />
                <span className="fx-scrap fx-scrap--four" />
              </div>
              <span className="fx-camera-line" />
            </div>

            <div className="fx-start-checklist">
              <div className="fx-check-row">
                <IconCheck />
                <span>Keep a small gap between pieces</span>
              </div>
              <div className="fx-check-row">
                <IconCheck />
                <span>Fit the whole table in the photo</span>
              </div>
              <div className="fx-check-row">
                <IconCheck />
                <span>Do not move scraps until the pack list appears</span>
              </div>
            </div>
          </div>

          <div className="fx-actions fx-actions--start">
            <button type="button" className="fx-btn fx-btn--primary" onClick={() => setStage('capture')}>
              <IconCamera />
              Scan table
            </button>
          </div>
        </div>
      </section>
    )
  } else if (stage === 'capture') {
    body = (
      <section className="fx-stage fx-home">
        <div className="fx-intro">
          <span className="fx-eyebrow">Factory scan</span>
          <h1 className="fx-title">Scan scraps</h1>
        </div>

        <div className="fx-frame fx-frame--idle" aria-label="No photo selected">
          <div className="fx-frame-hint">
            <IconCamera />
            <strong>Take a table photo</strong>
            <span>The app will group the scraps into boxes.</span>
          </div>
        </div>

        <div className="fx-actions">
          <label className="fx-btn fx-btn--primary">
            <IconCamera />
            Take photo
            <input type="file" accept="image/*" capture="environment" onChange={startScan} />
          </label>
          <label className="fx-btn-text">
            <IconImage />
            Upload photo
            <input type="file" accept="image/*" onChange={startScan} />
          </label>
        </div>
      </section>
    )
  } else if (stage === 'processing') {
    body = (
      <section className="fx-stage fx-processing">
        <div className="fx-intro">
          <span className="fx-eyebrow">Processing</span>
          <h1 className="fx-title">Building pack list</h1>
        </div>

        <div className="fx-frame fx-frame--scan">
          {previewUrl && <img src={previewUrl} alt="Your scrap pile" />}
          <div className="fx-readout">
            <span className="fx-readout-dot" />
            <span className="fx-readout-text">{STATUS_LINES[statusIdx]}</span>
          </div>
        </div>

        <div className="fx-bar-indeterminate">
          <span />
        </div>
        <p className="fx-mono-note">Usually done in a few seconds</p>
      </section>
    )
  } else if (stage === 'error') {
    body = (
      <section className="fx-stage">
        <Panel
          icon={<IconAlert />}
          title="Photo needs another try"
          text={error || 'Use brighter light, separate the scraps, and take the table straight on.'}
          onPick={startScan}
        />
      </section>
    )
  } else if (stage === 'plan') {
    body = (
      <section className="fx-stage fx-plan">
        <div className="fx-intro">
          <span className="fx-eyebrow">Pack list</span>
          <h1 className="fx-title">Sort into boxes</h1>
        </div>

        {groups.length === 0 ? (
          <Panel
            icon={<IconSearch />}
            title="No fabric groups found"
            text="Spread the pieces out more clearly and retake the table from above."
            onPick={startScan}
          />
        ) : (
          <>
            <button
              type="button"
              className="fx-frame fx-frame--plan"
              onClick={() => annotated && setZoomOpen(true)}
            >
              {annotated ? (
                <img src={annotated} alt="Annotated sorting plan" />
              ) : (
                <span className="fx-fallback">
                  <img ref={imgRef} src={previewUrl} alt="Your scrap pile" />
                  <canvas ref={canvasRef} className="fx-fallback-canvas" />
                </span>
              )}
              {annotated && (
                <span className="fx-zoom-hint">
                  <IconExpand />
                  View larger
                </span>
              )}
            </button>

            <div className="fx-progress" aria-label="Packing progress">
              <div className="fx-progress-copy">
                <span className="fx-progress-label">Boxes packed</span>
                <strong>{packed.size} of {groups.length}</strong>
              </div>
              <div className="fx-progress-bar">
                <div
                  className="fx-progress-fill"
                  style={{ width: `${(packed.size / groups.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="fx-section-heading">
              <h2>Pack manifest</h2>
            </div>

            <div className="fx-manifest">
              {groups.map((group, i) => {
                const key = group.sort_group_id || group.color_name
                const letter = group.sort_group_id || String.fromCharCode(65 + i)
                const isPacked = packed.has(key)
                const chip = group.outline_color || group.color_hex
                const count = group.piece_count
                return (
                  <button
                    type="button"
                    key={key}
                    className={`fx-box ${isPacked ? 'is-packed' : ''}`}
                    onClick={() => togglePacked(key)}
                  >
                    <span
                      className="fx-box-chip"
                      style={{ background: chip, color: readableOn(chip) }}
                    >
                      {letter}
                    </span>
                    <span className="fx-box-info">
                      <span className="fx-box-code">Box {letter}</span>
                      <span className="fx-box-name">
                        {capitalize(group.color_name)}
                        {group.fabric_type_guess ? ` - ${group.fabric_type_guess}` : ''}
                      </span>
                      <span className="fx-box-data">
                        {count} {count === 1 ? 'piece' : 'pieces'}
                        {group.total_weight_label ? ` - ${group.total_weight_label}` : ''}
                      </span>
                    </span>
                    <span className="fx-box-check" aria-hidden="true">
                      <IconCheck />
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="fx-actions fx-actions--sticky">
              <button type="button" className="fx-btn fx-btn--primary" onClick={finishBatch}>
                Finish Batch
              </button>
            </div>
          </>
        )}
      </section>
    )
  } else if (stage === 'listed') {
    const summary = finishedBatch || buildListingSummary(result)

    body = (
      <section className="fx-stage fx-listed">
        <div className="fx-listed-head">
          <div className="fx-listed-mark">
            <IconCheck />
          </div>
          <span className="fx-eyebrow">Listed just now</span>
          <h1 className="fx-title">Materials listed</h1>
          <p className="fx-lead">
            Created {summary.listings} {summary.listings === 1 ? 'listing' : 'listings'} from{' '}
            {summary.pieces} {summary.pieces === 1 ? 'piece' : 'pieces'} on this table.
          </p>
        </div>

        <div className="fx-listed-summary" aria-label="Created listing summary">
          <div>
            <span>Listings</span>
            <strong>{summary.listings}</strong>
          </div>
          <div>
            <span>Pieces</span>
            <strong>{summary.pieces}</strong>
          </div>
          <div>
            <span>Weight</span>
            <strong>{summary.weightLabel}</strong>
          </div>
        </div>

        <div className="fx-listed-table">
          <div className="fx-listed-table-head">
            <h2>Created lots</h2>
            <span>Buyer side</span>
          </div>
          <div className="fx-listed-rows">
            {summary.rows.map((row) => (
              <div className="fx-listed-row" key={row.key}>
                <span
                  className="fx-listed-swatch"
                  style={{ background: row.color, color: readableOn(row.color) }}
                >
                  {row.letter}
                </span>
                <span className="fx-listed-info">
                  <strong>{row.name}</strong>
                  <span>
                    {row.pieces} {row.pieces === 1 ? 'piece' : 'pieces'}
                    {row.weightLabel ? ` - ${row.weightLabel}` : ''}
                  </span>
                </span>
                <span className="fx-listed-state">Listed</span>
              </div>
            ))}
          </div>
        </div>

        <div className="fx-actions fx-actions--sticky">
          <button type="button" className="fx-btn fx-btn--primary" onClick={() => reset('capture')}>
            <IconCamera />
            Scan another table
          </button>
          <button type="button" className="fx-btn-text" onClick={() => setStage('plan')}>
            Back to pack list
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="factory-app">
      <FactoryHeader />
      <main className={`fx-main ${stage === 'start' ? 'fx-main--dashboard' : ''}`}>{body}</main>

      {zoomOpen && annotated && (
        <div className="fx-zoom" onClick={() => setZoomOpen(false)}>
          <button type="button" className="fx-zoom-close" aria-label="Close">
            <IconClose />
          </button>
          <img src={annotated} alt="Annotated sorting plan" />
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Bespoke header (replaces the shared site nav on this page)
// --------------------------------------------------------------------------

export function FactoryHeader() {
  const { logout } = useAuth()
  const [resetting, setResetting] = useState(false)

  async function handleReset() {
    if (resetting) return
    if (!window.confirm('Reset the demo? This permanently deletes all scanned lots and clears the marketplace. Logins and buyers stay.')) return
    setResetting(true)
    try {
      await resetDemoData()
      window.location.reload()
    } catch (err) {
      setResetting(false)
      alert('Reset failed: ' + (err?.message || 'unknown error'))
    }
  }

  return (
    <header className="fx-header">
      <Link className="fx-brand" to="/factory">
        <ReweaveLogo height={28} light />
      </Link>

      <div className="fx-header-actions">
        <button type="button" className="fx-reset" onClick={handleReset} disabled={resetting}>
          {resetting ? 'Resetting…' : 'Reset demo'}
        </button>
        <button type="button" className="fx-signout" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  )
}

function Panel({ icon, title, text, onPick }) {
  return (
    <div className="fx-panel">
      <div className="fx-panel-icon">{icon}</div>
      <h2 className="fx-panel-title">{title}</h2>
      <p className="fx-panel-text">{text}</p>
      <label className="fx-btn fx-btn--primary">
        <IconCamera />
        Retake photo
        <input type="file" accept="image/*" capture="environment" onChange={onPick} />
      </label>
    </div>
  )
}

// --------------------------------------------------------------------------
// Inline icons (no emoji). 1.6px stroke, currentColor.
// --------------------------------------------------------------------------

function svgProps() {
  return {
    width: '1em',
    height: '1em',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
}

function IconCamera() {
  return (
    <svg {...svgProps()}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  )
}

function IconImage() {
  return (
    <svg {...svgProps()}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="M5 17l4.5-4.5 3 3L16 12l3 3" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg {...svgProps()}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

function IconExpand() {
  return (
    <svg {...svgProps()}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg {...svgProps()}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg {...svgProps()}>
      <path d="M12 4.5l8.5 15h-17z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg {...svgProps()}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  )
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function buildListingSummary(res) {
  const groups = res ? [...(res.groups || [])].sort(sortByBin) : []
  const pieces = groups.reduce((sum, group) => sum + (Number(group.piece_count) || 0), 0)
  const weightG = groups.reduce((sum, group) => sum + (Number(group.estimated_weight_g) || 0), 0)

  return {
    listings: groups.length,
    pieces,
    weightLabel: weightG > 0 ? formatWeight(weightG) : 'Pending',
    rows: groups.map((group, i) => {
      const letter = group.sort_group_id || String.fromCharCode(65 + i)
      return {
        key: group.sort_group_id || `${group.color_name}-${i}`,
        letter,
        color: group.outline_color || group.color_hex || '#77736c',
        name: `${capitalize(group.color_name)}${group.fabric_type_guess ? ` - ${group.fabric_type_guess}` : ''}`,
        pieces: Number(group.piece_count) || 0,
        weightLabel: group.total_weight_label || (
          group.estimated_weight_g ? formatWeight(Number(group.estimated_weight_g)) : ''
        ),
      }
    }),
  }
}

function buildLotPayload(group) {
  return {
    name: `${capitalize(group.color_name)} ${group.fabric_type_guess || 'Scraps'}`.trim(),
    description: group.sort_instruction || '',
    fabric_type: group.fabric_type_guess || 'Unspecified',
    composition: group.composition_guess || 'Unspecified',
    color_name: group.color_name,
    color_hex: group.color_hex,
    piece_count: group.piece_count,
    weight_kg: group.estimated_weight_g ? Number((group.estimated_weight_g / 1000).toFixed(3)) : 0,
    price_usd: 0, // let the backend auto-price (see routers/lots.py:create_lot)
  }
}

function sortByBin(a, b) {
  const x = a.sort_group_id || a.color_name || ''
  const y = b.sort_group_id || b.color_name || ''
  return x.localeCompare(y)
}

function friendlyError(err) {
  const msg = (err && err.message) || ''
  if (msg.includes('400')) return 'We could not read that image. Take the photo again.'
  return 'Something went wrong on our side. Please try once more.'
}

function formatWeight(grams) {
  if (!Number.isFinite(grams) || grams <= 0) return ''
  if (grams >= 1000) {
    const kg = grams / 1000
    return `${kg >= 10 ? kg.toFixed(1) : kg.toFixed(2)} kg`
  }
  return `${Math.round(grams)} g`
}

// Pick dark or light text so the bin letter stays readable on any fabric color.
function readableOn(hex) {
  if (!hex || hex[0] !== '#') return '#FFFFFF'
  let c = hex.slice(1)
  if (c.length === 3) c = c.split('').map((x) => x + x).join('')
  if (c.length !== 6) return '#FFFFFF'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#15191F' : '#FFFFFF'
}

function capitalize(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
