// Thin wrapper around the backend API. Every page should go through here so
// the request/response shapes stay in one place -- see backend/app/schemas.py
// for the matching Pydantic models.

const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
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
// Factory records + lots (Person 2)
// ---------------------------------------------------------------------------

export function getFactoryRecords() {
  return request('/factory-records')
}

export function createFactoryRecord(record) {
  return request('/factory-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
}

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
