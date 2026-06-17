// Thin wrapper around the backend API. Every page should go through here so
// the request/response shapes stay in one place -- see backend/app/schemas.py
// for the matching Pydantic models.

const BASE = '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('reweave_token')
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Vision (Person 1)
// ---------------------------------------------------------------------------

export function detectScrap(file, options = {}) {
  const formData = new FormData()
  formData.append('image', file)
  if (options.useDeployment !== undefined) {
    formData.append('use_deployment', options.useDeployment ? 'true' : 'false')
  }
  return request('/vision/detect', { method: 'POST', body: formData })
}

// Fire-and-forget: boot the Replicate SAM container ahead of the first real scan
// so the worker (especially on a phone) never pays the cold-start delay. Safe to
// call repeatedly; the backend returns immediately and warms in the background.
export function warmupVision() {
  return request('/vision/warmup', { method: 'POST' }).catch(() => {})
}

// ---------------------------------------------------------------------------
// Auth / current user
// ---------------------------------------------------------------------------

export function getMe() {
  return request('/auth/me')
}

export function saveMyLocation(lat, lng) {
  return request('/auth/me/location', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  })
}

// ---------------------------------------------------------------------------
// Lots (Person 2)
// ---------------------------------------------------------------------------

export function getLots(filters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value)
    }
  }
  const query = params.toString()
  return request(`/lots${query ? `?${query}` : ''}`)
}

export function getLotFilterOptions() {
  return request('/lots/filters')
}

export function createLot(lot) {
  return request('/lots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lot),
  })
}

export function createScanRun(scanRun) {
  return request('/lots/scan-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scanRun),
  })
}

// ---------------------------------------------------------------------------
// Marketplace + impact (Person 4)
// ---------------------------------------------------------------------------

export function getBuyers() {
  return request('/marketplace/buyers')
}

export function getActivity() {
  return request('/marketplace/activity')
}

export function claimLot(lotId, buyerName, quantityKg = null) {
  const body = { buyer_name: buyerName }
  if (quantityKg !== undefined && quantityKg !== null) body.quantity_kg = quantityKg
  return request(`/lots/${lotId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getImpact() {
  return request('/impact')
}

export function delistLot(lotId) {
  return request(`/lots/${lotId}/delist`, { method: 'PATCH' })
}

export function relistLot(lotId) {
  return request(`/lots/${lotId}/relist`, { method: 'PATCH' })
}

export function deleteLot(lotId) {
  return request(`/lots/${lotId}`, { method: 'DELETE' })
}

export function getAdminMetrics() {
  return request('/admin/metrics')
}

// ---------------------------------------------------------------------------
// Demo reset — wipes all scanned lots (keeps logins + buyers)
// ---------------------------------------------------------------------------

export function resetDemoData() {
  return request('/admin/reset-demo', { method: 'POST' })
}

// ---------------------------------------------------------------------------
// AI Material Destination Engine
// ---------------------------------------------------------------------------

export function analyzeDestinations(payload) {
  return request('/destinations/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
