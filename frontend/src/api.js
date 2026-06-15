// Thin wrapper around the backend API. Every page should go through here so
// the request/response shapes stay in one place -- see backend/app/schemas.py
// for the matching Pydantic models.

const BASE = '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('scrap_token')
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

export function detectScrap(file) {
  const formData = new FormData()
  formData.append('image', file)
  return request('/vision/detect', { method: 'POST', body: formData })
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

// ---------------------------------------------------------------------------
// Marketplace + impact (Person 4)
// ---------------------------------------------------------------------------

export function getBuyers() {
  return request('/marketplace/buyers')
}

export function getActivity() {
  return request('/marketplace/activity')
}

export function claimLot(lotId, buyerName) {
  return request(`/lots/${lotId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buyer_name: buyerName }),
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
