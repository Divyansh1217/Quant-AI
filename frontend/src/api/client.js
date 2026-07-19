const BASE = '/api/v1'

function authHeaders() {
  const token = localStorage.getItem('quantai_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export async function getRecommendation(ticker, lane = 'FAST') {
  const res = await fetch(`${BASE}/recommend`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ticker, lane }),
  })
  if (res.status === 401) throw new Error('Session expired')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getPortfolio(tickers, lane = 'FAST') {
  const res = await fetch(`${BASE}/portfolio`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tickers, lane }),
  })
  if (res.status === 401) throw new Error('Session expired')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getBacktest(ticker, periodYears = 2, lane = 'FAST') {
  const res = await fetch(`${BASE}/backtest`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ticker, period_years: periodYears, lane }),
  })
  if (res.status === 401) throw new Error('Session expired')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchStockHistory(ticker, period = '6mo') {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${period}&interval=1d`)
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`)
  const data = await res.json()
  const result = data.chart.result[0]
  const timestamps = result.timestamp
  const quote = result.indicators.quote[0]
  return timestamps.map((ts, i) => ({
    date: new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    timestamp: ts,
    open: quote.open[i],
    high: quote.high[i],
    low: quote.low[i],
    close: quote.close[i],
    volume: quote.volume[i],
  })).filter(d => d.close != null)
}
