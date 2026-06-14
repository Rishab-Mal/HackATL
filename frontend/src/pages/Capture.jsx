import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createLot, detectScrap, getFactoryRecords } from '../api.js'

// Person 3 (frontend) owns this screen. Person 1 (vision) owns the
// /api/vision/detect response shape this page renders -- see
// backend/app/schemas.py: DetectResponse / Piece / ColorGroup.

export default function Capture() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [factoryRecords, setFactoryRecords] = useState([])
  const [activeGroup, setActiveGroup] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [savedMessage, setSavedMessage] = useState(null)

  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    getFactoryRecords().then(setFactoryRecords).catch(() => {})
  }, [])

  function handleFileChange(e) {
    const selected = e.target.files[0]
    if (!selected) return
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setResult(null)
    setSavedMessage(null)
  }

  async function handleDetect() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      setResult(await detectScrap(file))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Draw bounding boxes for each detected piece over the preview image.
  useEffect(() => {
    if (!result || !imgRef.current || !canvasRef.current) return
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
        ctx.strokeStyle = piece.color_hex
        ctx.lineWidth = 2
        ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY)
      })
    }

    if (img.complete) draw()
    else img.onload = draw
  }, [result, previewUrl])

  function openGroupForm(group) {
    setActiveGroup(group)
    setForm({ ...emptyForm(), name: `${capitalize(group.color_name)} Scraps` })
    setSavedMessage(null)
  }

  async function handleCreateLot(e) {
    e.preventDefault()
    if (!activeGroup) return

    const payload = {
      name: form.name,
      fabric_type: form.fabric_type || 'Unspecified',
      composition: form.composition || 'Unspecified',
      color_name: activeGroup.color_name,
      color_hex: activeGroup.color_hex,
      piece_count: activeGroup.piece_count,
      weight_kg: parseFloat(form.weight_kg) || 0,
      price_usd: parseFloat(form.price_usd) || 0,
      factory_record_id: form.factory_record_id ? parseInt(form.factory_record_id, 10) : null,
    }

    try {
      await createLot(payload)
      setSavedMessage(`Lot "${payload.name}" created.`)
      setActiveGroup(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page capture">
      <h1>1. Capture scrap pile</h1>
      <p className="subtitle">
        Upload a photo of mixed fabric scraps to detect and group pieces by color and size.
      </p>

      <div className="capture-controls">
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <button onClick={handleDetect} disabled={!file || loading}>
          {loading ? 'Detecting...' : 'Detect pieces'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {previewUrl && (
        <div className="image-wrap">
          <img ref={imgRef} src={previewUrl} alt="Scrap pile" />
          <canvas ref={canvasRef} className="overlay" />
        </div>
      )}

      {result && (
        <div className="results">
          <h2>2. Sorted groups (before to after)</h2>
          <p className="subtitle">
            {result.pieces.length} pieces detected across {result.groups.length} color groups.
          </p>
          <div className="group-grid">
            {result.groups.map((group) => (
              <div className="group-card" key={group.color_name}>
                <div className="swatch" style={{ background: group.color_hex }} />
                <div className="group-info">
                  <strong>{capitalize(group.color_name)}</strong>
                  <span>{group.piece_count} pieces</span>
                  <span>{group.total_size_percent}% of pile - {group.avg_size_label}</span>
                </div>
                <button onClick={() => openGroupForm(group)}>Create lot</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeGroup && (
        <form className="lot-form" onSubmit={handleCreateLot}>
          <h3>New lot: {capitalize(activeGroup.color_name)} scraps</h3>
          <label>
            Lot name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Fabric type
            <input
              value={form.fabric_type}
              onChange={(e) => setForm({ ...form, fabric_type: e.target.value })}
              placeholder="e.g. Cotton/Spandex Jersey"
            />
          </label>
          <label>
            Composition
            <input
              value={form.composition}
              onChange={(e) => setForm({ ...form, composition: e.target.value })}
              placeholder="e.g. 95% cotton, 5% spandex"
            />
          </label>
          <label>
            Weight (kg)
            <input
              type="number"
              step="0.1"
              value={form.weight_kg}
              onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
            />
          </label>
          <label>
            Price (USD)
            <input
              type="number"
              step="0.5"
              value={form.price_usd}
              onChange={(e) => setForm({ ...form, price_usd: e.target.value })}
            />
          </label>
          <label>
            Factory record (optional)
            <select
              value={form.factory_record_id}
              onChange={(e) => setForm({ ...form, factory_record_id: e.target.value })}
            >
              <option value="">None</option>
              {factoryRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.batch_name} - {r.composition}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit">Save lot</button>
            <button type="button" onClick={() => setActiveGroup(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {savedMessage && (
        <div className="success">
          {savedMessage}{' '}
          <a onClick={() => navigate('/lots')}>View sorted lots &rarr;</a>
        </div>
      )}
    </div>
  )
}

function emptyForm() {
  return { name: '', fabric_type: '', composition: '', weight_kg: '', price_usd: '', factory_record_id: '' }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
