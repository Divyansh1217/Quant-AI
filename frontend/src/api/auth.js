const BASE = '/auth'

export async function registerUser(email, username, password) {
  const res = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }))
    throw new Error(err.detail || 'Registration failed')
  }
  return res.json()
}

export async function loginUser(email, password) {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }))
    throw new Error(err.detail || 'Login failed')
  }
  return res.json()
}

export async function getMe(token) {
  const res = await fetch(`${BASE}/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Token expired or invalid')
  return res.json()
}

export async function getWatchlist(token) {
  const res = await fetch(`${BASE}/watchlist`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch watchlist')
  return res.json()
}

export async function addToWatchlist(token, ticker, label = 'My Watchlist') {
  const res = await fetch(`${BASE}/watchlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ ticker, label }),
  })
  if (!res.ok) throw new Error('Failed to add to watchlist')
  return res.json()
}

export async function removeFromWatchlist(token, itemId) {
  const res = await fetch(`${BASE}/watchlist/${itemId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to remove from watchlist')
}

export async function getHistory(token) {
  const res = await fetch(`${BASE}/history`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

export async function saveHistory(token, ticker, analysisType, result) {
  const res = await fetch(`${BASE}/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ ticker, analysis_type: analysisType, result }),
  })
  if (!res.ok) throw new Error('Failed to save history')
}
