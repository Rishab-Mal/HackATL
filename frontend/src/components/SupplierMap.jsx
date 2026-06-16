import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { formatInputKg, formatImpactMass, formatMoney, formatWater, formatWeightKg, lotQuantityStep } from '../utils/formatters.js'
import { useCart } from '../context/CartContext.jsx'
import { getMe, saveMyLocation } from '../api.js'

// Vite exposes this at build time. Keep the real value in frontend/.env.
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

// Default buyer position — NYC garment district, until the browser shares a real one
const DEFAULT_BUYER = { lat: 40.7128, lng: -74.006 }
const FACTORY_CLUSTER_RADIUS_KM = 1.0

// Build the map's factories from the real origins stamped on lots at scan time.
// Lots without a shared location simply do not appear, so there is no sample data.
// Names come from reverse geocoding the coordinates (see the component), not from
// anything hardcoded.
function buildFactories(lots) {
  const groups = []
  for (const lot of lots) {
    if (typeof lot.origin_lat !== 'number' || typeof lot.origin_lng !== 'number') continue
    const existing = groups.find((group) =>
      haversineKm(group.lat, group.lng, lot.origin_lat, lot.origin_lng) <= FACTORY_CLUSTER_RADIUS_KM
    )

    if (existing) {
      const nextCount = existing.lots.length + 1
      existing.lat = (existing.lat * existing.lots.length + lot.origin_lat) / nextCount
      existing.lng = (existing.lng * existing.lots.length + lot.origin_lng) / nextCount
      existing.lots.push(lot)
    } else {
      groups.push({ lat: lot.origin_lat, lng: lot.origin_lng, lots: [lot] })
    }
  }
  return groups.map((g, i) => ({
    id: i,
    key: `${g.lat.toFixed(3)},${g.lng.toFixed(3)}`,
    lat: g.lat,
    lng: g.lng,
    lots: g.lots,
    totalKg: g.lots.reduce((s, l) => s + (l.weight_kg || 0), 0),
  }))
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// $0.08 / lb / 100 miles — standard LTL freight estimate
function shippingEst(km, weightKg) {
  const miles = km * 0.621371
  const lbs = weightKg * 2.205
  return (miles / 100) * lbs * 0.08
}

// Curved flow line. The bulge is perpendicular to the route and scaled to its
// length, so short routes stay gently curved instead of spiking straight up.
function arcCoords(from, to, steps = 64) {
  const [x1, y1] = from
  const [x2, y2] = to
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy) || 1
  const nx = -dy / dist
  const ny = dx / dist
  const bulge = dist * 0.18
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const offset = Math.sin(Math.PI * t) * bulge
    pts.push([x1 + dx * t + nx * offset, y1 + dy * t + ny * offset])
  }
  return pts
}

// Mapbox animated dash sequence (from the Mapbox line-animation example)
const DASH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5],
  [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
]

export default function SupplierMap({ lots }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const rafRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [buyerPos, setBuyerPos] = useState(DEFAULT_BUYER)
  const [locating, setLocating] = useState(false)
  const [located, setLocated] = useState(false)
  const [placeNames, setPlaceNames] = useState({})
  const { cart, addToCart, updateQty, removeFromCart } = useCart()
  const [draftQty, setDraftQty] = useState({})

  // Real origins captured from the factory floor. One scan with a shared
  // location gives one populated pin, so a single demo run already looks right.
  const rawFactories = buildFactories(lots)
  const factories = rawFactories.map(f => ({ ...f, name: placeNames[f.key] || 'Factory location' }))
  const factoryKeys = rawFactories.map(f => f.key).join('|')
  const sel = selected !== null && selected < factories.length ? factories[selected] : null

  // Init map once
  useEffect(() => {
    if (!TOKEN || mapRef.current) return
    mapboxgl.accessToken = TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-83.5, 34.4],
      zoom: 5.5,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Use the buyer's saved location if we have one, otherwise ask the browser
  // and persist whatever it returns so the next visit is instant.
  useEffect(() => {
    let cancelled = false
    getMe()
      .then(me => {
        if (cancelled) return
        if (typeof me?.lat === 'number' && typeof me?.lng === 'number') {
          setBuyerPos({ lat: me.lat, lng: me.lng })
          setLocated(true)
        } else {
          locateMe(true)
        }
      })
      .catch(() => { if (!cancelled) locateMe(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw factory markers when lots or selection changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const render = () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      factories.forEach((factory, i) => {
        const el = document.createElement('div')
        el.className = `map-pin${selected === i ? ' map-pin--active' : ''}`
        el.innerHTML = `<span class="map-pin-count">${factory.lots.length}</span>`
        el.addEventListener('click', e => {
          e.stopPropagation()
          setSelected(prev => (prev === i ? null : i))
        })

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([factory.lng, factory.lat])
          .addTo(map)
        markersRef.current.push(marker)
      })
    }

    if (map.isStyleLoaded()) render()
    else map.once('load', render)
  }, [lots, selected])

  // Animated waste-flow arcs + buyer dot
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const draw = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      // Clean up previous layers/sources
      ;['flow-anim', 'flow-base', 'buyer-pulse', 'buyer-dot'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id)
      })
      ;['flow-src', 'buyer-src'].forEach(id => {
        if (map.getSource(id)) map.removeSource(id)
      })

      const features = factories
        // Only draw a flow when there is real distance to cover. When the buyer
        // is essentially at the factory there is no meaningful route to show.
        .filter(f => f.lots.length > 0 && haversineKm(buyerPos.lat, buyerPos.lng, f.lat, f.lng) > 8)
        .map(f => ({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: arcCoords([f.lng, f.lat], [buyerPos.lng, buyerPos.lat]),
          },
          properties: {},
        }))

      map.addSource('flow-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      })
      map.addLayer({
        id: 'flow-base',
        type: 'line',
        source: 'flow-src',
        paint: { 'line-color': '#166534', 'line-width': 1.5, 'line-opacity': 0.14 },
      })
      map.addLayer({
        id: 'flow-anim',
        type: 'line',
        source: 'flow-src',
        paint: {
          'line-color': '#166534',
          'line-width': 2.5,
          'line-opacity': 0.8,
          'line-dasharray': [0, 4, 3],
        },
      })

      map.addSource('buyer-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [buyerPos.lng, buyerPos.lat] },
          properties: {},
        },
      })
      map.addLayer({
        id: 'buyer-pulse',
        type: 'circle',
        source: 'buyer-src',
        paint: { 'circle-radius': 16, 'circle-color': '#166534', 'circle-opacity': 0.12 },
      })
      map.addLayer({
        id: 'buyer-dot',
        type: 'circle',
        source: 'buyer-src',
        paint: {
          'circle-radius': 7,
          'circle-color': '#166534',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#fff',
        },
      })

      // Animate the dash pattern so flows feel like material moving
      let step = 0
      let lastTs = 0
      const animate = ts => {
        if (!mapRef.current) return
        if (ts - lastTs > 55) {
          step = (step + 1) % DASH_SEQ.length
          if (map.getLayer('flow-anim')) {
            map.setPaintProperty('flow-anim', 'line-dasharray', DASH_SEQ[step])
          }
          lastTs = ts
        }
        rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    if (map.isStyleLoaded()) draw()
    else map.once('load', draw)
  }, [buyerPos, lots])

  // Turn each origin's coordinates into a real place name via Mapbox reverse
  // geocoding, instead of inventing a factory name.
  useEffect(() => {
    if (!TOKEN || rawFactories.length === 0) return
    let cancelled = false
    Promise.all(rawFactories.map(async (f) => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${f.lng},${f.lat}.json` +
          `?access_token=${TOKEN}&types=place,locality,region&limit=1`
        )
        const json = await res.json()
        const feat = json?.features?.[0]
        return [f.key, feat?.text || feat?.place_name || 'Factory location']
      } catch {
        return [f.key, 'Factory location']
      }
    })).then((entries) => {
      if (cancelled) return
      setPlaceNames((prev) => {
        const next = { ...prev }
        let changed = false
        for (const [k, v] of entries) if (next[k] !== v) { next[k] = v; changed = true }
        return changed ? next : prev
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factoryKeys])

  // Frame the map. With a single factory we center tightly on it (and only pull
  // in the buyer when they are nearby), so the demo's one pin is never a lonely
  // dot floating off-center.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      if (factories.length === 0) {
        map.flyTo({ center: [buyerPos.lng, buyerPos.lat], zoom: 4.5, duration: 900 })
        return
      }
      const nearestKm = Math.min(
        ...factories.map(f => haversineKm(buyerPos.lat, buyerPos.lng, f.lat, f.lng))
      )
      const includeBuyer = nearestKm > 8 && nearestKm < 400
      if (factories.length === 1 && !includeBuyer) {
        map.flyTo({ center: [factories[0].lng, factories[0].lat], zoom: 9.5, duration: 1100 })
        return
      }
      const bounds = new mapboxgl.LngLatBounds()
      factories.forEach(f => bounds.extend([f.lng, f.lat]))
      if (includeBuyer) bounds.extend([buyerPos.lng, buyerPos.lat])
      map.fitBounds(bounds, { padding: 110, maxZoom: 10, duration: 1100 })
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots, buyerPos])

  function locateMe(silent = false) {
    if (!navigator.geolocation || locating) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setBuyerPos({ lat, lng })
        setLocated(true)
        setLocating(false)
        // Persist so the map and shipping math use it on the next visit too.
        saveMyLocation(lat, lng).catch(() => {})
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  function selectedQty(lot) {
    return cart[lot.id]?.qty ?? draftQty[lot.id] ?? defaultQty(lot.weight_kg)
  }

  function setQty(lot, value) {
    const next = clampQty(Number(value), lot.weight_kg)
    setDraftQty((prev) => ({ ...prev, [lot.id]: next }))
    if (cart[lot.id]) {
      if (next > 0) updateQty(lot.id, next)
      else removeFromCart(lot.id)
    }
  }

  return (
    <div className="supplier-map-layout">
      {/* Map canvas */}
      <div className="supplier-map-canvas-wrap">
        <div ref={containerRef} className="supplier-map-canvas" />

        <div className="map-overlay-controls">
          <button className="map-locate-btn" onClick={() => locateMe(false)} disabled={locating}>
            {locating ? 'Locating…' : located ? '⊙ Using your location' : '⊙ Use my location'}
          </button>
        </div>

        <div className="map-legend">
          <div className="map-legend-row">
            <span className="map-legend-pin" />
            <span>Factory with lots available</span>
          </div>
          <div className="map-legend-row">
            <span className="map-legend-arc" />
            <span>Textile flow to you</span>
          </div>
          <div className="map-legend-row">
            <span className="map-legend-buyer" />
            <span>Your location</span>
          </div>
        </div>

        {factories.length === 0 && (
          <div className="map-empty-overlay">
            <div className="map-empty-card">
              <div className="map-empty-title">No factory locations yet</div>
              <div className="map-empty-sub">
                When a factory worker shares their location during a scan, their lots
                show up here on the map.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="supplier-map-sidebar">
        {!sel ? (
          <div className="map-sidebar-hint">
            <div className="map-sidebar-hint-title">
              {factories.length === 0 ? 'Waiting on a factory scan' : 'Pick a factory'}
            </div>
            <div className="map-sidebar-hint-sub">
              {factories.length === 0
                ? 'Factory locations appear here once a worker shares their location while scanning a table.'
                : 'Tap a pin on the map to see the lots it has available and what shipping to you would run.'}
            </div>

            <div className="map-factory-list">
              {factories.map((f, i) => {
                const km = haversineKm(buyerPos.lat, buyerPos.lng, f.lat, f.lng)
                const miles = (km * 0.621371).toFixed(0)
                return (
                  <button key={f.id} className="map-factory-row" onClick={() => setSelected(i)}>
                    <span className="map-factory-dot" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="map-factory-row-name">{f.name}</div>
                      <div className="map-factory-row-meta">{miles} mi away · {formatWeightKg(f.totalKg)}</div>
                    </div>
                    <span className="map-factory-row-count">{f.lots.length} lots</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="map-sidebar-factory-header">
              <button className="map-back-btn" onClick={() => setSelected(null)}>
                ← All factories
              </button>
              <div className="map-sidebar-factory-name">{sel.name}</div>
              <div className="map-sidebar-factory-city">Shared from the factory floor</div>

              <div className="map-sidebar-factory-stats">
                {(() => {
                  const km = haversineKm(buyerPos.lat, buyerPos.lng, sel.lat, sel.lng)
                  const miles = (km * 0.621371).toFixed(0)
                  const est = shippingEst(km, sel.totalKg)
                  return (
                    <>
                      <div className="map-stat">
                        <div className="map-stat-val">{miles} mi</div>
                        <div className="map-stat-label">Distance</div>
                      </div>
                      <div className="map-stat-divider" />
                      <div className="map-stat">
                        <div className="map-stat-val">{sel.lots.length}</div>
                        <div className="map-stat-label">Lots</div>
                      </div>
                      <div className="map-stat-divider" />
                      <div className="map-stat">
                        <div className="map-stat-val">${est.toFixed(0)}</div>
                        <div className="map-stat-label">Est. shipping</div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            <div className="map-sidebar-lots">
              {sel.lots.length === 0 ? (
                <p style={{ color: 'var(--c-muted)', fontSize: 13, padding: '20px 0' }}>
                  Nothing available from this factory right now.
                </p>
              ) : (
                sel.lots.map(lot => {
                  const inCart = !!cart[lot.id]
                  const img = firstImage(lot)
                  const qty = selectedQty(lot)
                  const step = lotQuantityStep(lot.weight_kg)
                  const gramScale = lot.weight_kg < 1
                  const inputStep = gramScale ? step * 1000 : step
                  const inputMax = gramScale ? lot.weight_kg * 1000 : lot.weight_kg
                  const inputValue = gramScale ? formatInputGrams(qty) : formatInputKg(qty)
                  const selectedPrice = proratedPrice(lot, qty)
                  return (
                    <div
                      className={`map-lot-card${inCart ? ' map-lot-card--incart' : ''}`}
                      key={lot.id}
                    >
                      {img ? (
                        <img className="map-lot-thumb" src={img} alt={`${lot.name} fabric`} />
                      ) : (
                        <div className="map-lot-thumb map-lot-thumb--swatch" style={{ background: lot.color_hex }} />
                      )}
                      <div className="map-lot-info">
                        <div className="map-lot-type">{lot.fabric_type}</div>
                        <div className="map-lot-name">{lot.name}</div>
                        <div className="map-lot-price-row">
                          <span className="map-lot-price">{formatMoney(selectedPrice)}</span>
                          {lot.price_decay_pct > 0 && (
                            <span className="map-lot-badge">−{lot.price_decay_pct}%</span>
                          )}
                          <span className="map-lot-weight">{formatWeightKg(lot.weight_kg)}</span>
                        </div>
                        <div className="map-lot-impact">
                          {formatImpactMass(lot.carbon_saved_kg)} CO₂ · {formatWater(lot.water_saved_l)} water
                        </div>
                        <div className="map-lot-qty">
                          <input
                            type="range"
                            min={0}
                            max={lot.weight_kg}
                            step={step}
                            value={qty}
                            onChange={e => setQty(lot, e.target.value)}
                            aria-label={`Quantity for ${lot.name}`}
                          />
                          <div className="map-lot-qty-field">
                            <input
                              type="number"
                              min={0}
                              max={inputMax}
                              step={inputStep}
                              value={inputValue}
                              onChange={e => setQty(lot, gramScale ? Number(e.target.value) / 1000 : e.target.value)}
                              aria-label={`Quantity in ${gramScale ? 'grams' : 'kilograms'} for ${lot.name}`}
                            />
                            <span>{gramScale ? 'g' : 'kg'}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        className={`map-lot-btn${inCart ? ' map-lot-btn--added' : ''}`}
                        onClick={() =>
                          inCart ? removeFromCart(lot.id) : addToCart(lot, null, qty)
                        }
                        disabled={!inCart && qty <= 0}
                        title={inCart ? 'Remove from order' : 'Add to order'}
                      >
                        {inCart ? 'Remove' : 'Add'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function firstImage(lot) {
  const imgs = normalizePieceImages(lot?.piece_images)
  return imgs[0]?.src || null
}

function normalizePieceImages(images) {
  if (!Array.isArray(images)) return []
  return images
    .map((img) => {
      if (typeof img === 'string') return { src: img }
      if (img && typeof img === 'object') {
        const src = img.src || img.url || img.crop_data_url || img.data_url
        if (src) return { ...img, src }
      }
      return null
    })
    .filter(Boolean)
}

function defaultQty(weightKg) {
  const weight = Number(weightKg) || 0
  if (weight <= 0) return 0
  if (weight <= 0.25) return weight
  return Number(Math.min(weight, Math.max(0.1, weight * 0.5)).toFixed(3))
}

function clampQty(value, max) {
  const maximum = Number(max) || 0
  if (!Number.isFinite(value)) return 0
  return Number(Math.min(Math.max(value, 0), maximum).toFixed(3))
}

function proratedPrice(lot, qty) {
  const weight = Number(lot.weight_kg) || 0
  const price = Number(lot.current_price_usd) || 0
  const selected = Number(qty) || 0
  if (weight <= 0 || selected >= weight) return price
  return Number((price * (selected / weight)).toFixed(4))
}

function formatInputGrams(kg) {
  const grams = (Number(kg) || 0) * 1000
  return grams < 10 ? grams.toFixed(1).replace(/\.?0+$/, '') : String(Math.round(grams))
}
