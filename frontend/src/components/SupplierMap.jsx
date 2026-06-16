import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { formatWeightKg } from '../utils/formatters.js'
import { useCart } from '../context/CartContext.jsx'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// Carter's territory + regional textile suppliers (demo data)
const FACTORIES = [
  { id: 0, name: "Carter's — Atlanta", city: 'Atlanta, GA', lat: 33.749, lng: -84.388 },
  { id: 1, name: "Carter's — Braselton", city: 'Braselton, GA', lat: 34.108, lng: -83.777 },
  { id: 2, name: 'Fort Payne Textiles', city: 'Fort Payne, AL', lat: 34.444, lng: -85.719 },
  { id: 3, name: 'Carolinas Mill Co.', city: 'Charlotte, NC', lat: 35.227, lng: -80.843 },
]

// Default buyer position — NYC garment district
const DEFAULT_BUYER = { lat: 40.7128, lng: -74.006 }

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

// Great-circle arc with visual bulge
function arcCoords(from, to, steps = 60) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push([
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t + Math.sin(Math.PI * t) * 2.2,
    ])
  }
  return pts
}

// Mapbox animated dash sequence (from Mapbox docs)
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
  const { cart, addToCart, removeFromCart } = useCart()

  // Assign lots to factories by lot ID mod 4
  const factories = FACTORIES.map(f => ({
    ...f,
    lots: lots.filter(l => (l.id % FACTORIES.length) === f.id),
    totalKg: lots
      .filter(l => (l.id % FACTORIES.length) === f.id)
      .reduce((s, l) => s + (l.weight_kg || 0), 0),
  }))

  const sel = selected !== null ? factories[selected] : null

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
        .filter(f => f.lots.length > 0)
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

      // Animate the dash pattern
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

  function locateMe() {
    if (!navigator.geolocation || locating) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setBuyerPos({ lat, lng })
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 6.5, duration: 1600 })
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  if (!TOKEN) {
    return (
      <div className="map-no-token">
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗺</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Mapbox token required</div>
        <div style={{ color: 'var(--c-muted)', fontSize: 13, lineHeight: 1.6 }}>
          Add <code style={{ background: 'var(--c-bg)', padding: '1px 5px', borderRadius: 3 }}>VITE_MAPBOX_TOKEN=pk.eyJ…</code> to <code style={{ background: 'var(--c-bg)', padding: '1px 5px', borderRadius: 3 }}>.env</code> and restart the dev server.
          <br />
          Get a free token at <strong>mapbox.com</strong>.
        </div>
      </div>
    )
  }

  return (
    <div className="supplier-map-layout">
      {/* Map canvas */}
      <div className="supplier-map-canvas-wrap">
        <div ref={containerRef} className="supplier-map-canvas" />

        <div className="map-overlay-controls">
          <button className="map-locate-btn" onClick={locateMe} disabled={locating}>
            {locating ? '…' : '⊙ My location'}
          </button>
        </div>

        <div className="map-legend">
          <div className="map-legend-row">
            <span className="map-legend-pin" />
            <span>Factory · lots available</span>
          </div>
          <div className="map-legend-row">
            <span className="map-legend-arc" />
            <span>Textile waste flow</span>
          </div>
          <div className="map-legend-row">
            <span className="map-legend-buyer" />
            <span>Your location</span>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="supplier-map-sidebar">
        {!sel ? (
          <div className="map-sidebar-hint">
            <div style={{ fontSize: 28, marginBottom: 10 }}>📍</div>
            <div className="map-sidebar-hint-title">Select a factory</div>
            <div className="map-sidebar-hint-sub">
              Click any pin on the map to see available lots and estimated shipping costs
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
                      <div className="map-factory-row-meta">{f.city} · {miles} mi away</div>
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
              <div className="map-sidebar-factory-city">{sel.city}</div>

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
                  No lots currently available from this factory.
                </p>
              ) : (
                sel.lots.map(lot => {
                  const inCart = !!cart[lot.id]
                  return (
                    <div
                      className={`map-lot-card${inCart ? ' map-lot-card--incart' : ''}`}
                      key={lot.id}
                    >
                      <div className="map-lot-swatch" style={{ background: lot.color_hex }} />
                      <div className="map-lot-info">
                        <div className="map-lot-type">{lot.fabric_type}</div>
                        <div className="map-lot-name">{lot.name}</div>
                        <div className="map-lot-price-row">
                          <span className="map-lot-price">${lot.current_price_usd?.toFixed(2)}</span>
                          {lot.price_decay_pct > 0 && (
                            <span className="map-lot-badge">−{lot.price_decay_pct}%</span>
                          )}
                          <span className="map-lot-weight">{formatWeightKg(lot.weight_kg)}</span>
                        </div>
                        <div className="map-lot-impact">
                          {lot.carbon_saved_kg} kg CO₂ · {(lot.water_saved_l / 1000).toFixed(1)}K L water
                        </div>
                      </div>
                      <button
                        className={`map-lot-btn${inCart ? ' map-lot-btn--added' : ''}`}
                        onClick={() =>
                          inCart ? removeFromCart(lot.id) : addToCart(lot, null, lot.weight_kg)
                        }
                        title={inCart ? 'Remove from order' : 'Add to order'}
                      >
                        {inCart ? '✓' : '+'}
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
