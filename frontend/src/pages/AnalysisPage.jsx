import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Zap, AlertCircle, Download, Star, Trash2, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, ReferenceLine } from 'recharts'
import { getRecommendation, fetchStockHistory } from '../api/client'
import MetricCard from '../components/MetricCard'
import SignalBadge from '../components/SignalBadge'
import { SkeletonCard, SkeletonChart } from '../components/SkeletonLoader'
import { toast } from '../components/Toast'

const WATCHLIST_KEY = 'quantai_watchlist'

function loadWatchlist() {
  try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || [] } catch { return [] }
}
function saveWatchlist(w) { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(w)) }

const POPULAR = [
  { ticker: 'AAPL', name: 'Apple' },
  { ticker: 'NVDA', name: 'NVIDIA' },
  { ticker: 'TSLA', name: 'Tesla' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'GOOGL', name: 'Alphabet' },
]

const CHART_TOOLTIP = { contentStyle: { background: '#151b27', border: '1px solid #1e293b', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' } }

export default function AnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [ticker, setTicker] = useState(searchParams.get('ticker') || '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState(null)
  const [error, setError] = useState(null)
  const [watchlist, setWatchlist] = useState(loadWatchlist)

  const analyze = useCallback(async (t) => {
    if (!t?.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setHistory(null)
    try {
      const [rec, hist] = await Promise.all([
        getRecommendation(t.trim()),
        fetchStockHistory(t.trim(), '6mo'),
      ])
      setResult(rec)
      setHistory(hist)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = searchParams.get('ticker')
    if (t) { setTicker(t); analyze(t) }
  }, [searchParams.get('ticker')])

  const toggleWatchlist = (t) => {
    const next = watchlist.includes(t) ? watchlist.filter(x => x !== t) : [...watchlist, t]
    setWatchlist(next)
    saveWatchlist(next)
    toast(watchlist.includes(t) ? `Removed ${t} from watchlist` : `Added ${t} to watchlist`, 'success')
  }

  const exportCSV = () => {
    if (!history?.length) return
    const header = 'Date,Open,High,Low,Close,Volume\n'
    const rows = history.map(d => `${d.date},${d.open?.toFixed(2)},${d.high?.toFixed(2)},${d.low?.toFixed(2)},${d.close?.toFixed(2)},${d.volume}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${ticker}_data.csv`; a.click()
    URL.revokeObjectURL(url)
    toast('CSV exported successfully', 'success')
  }

  const mlData = result?.ml_data
  const features = mlData?.features || {}
  const probs = mlData?.probability_matrix || {}
  const currentTicker = mlData?.target_asset || ticker.toUpperCase()

  const rsiData = history?.map((d, i) => {
    const closes = history.slice(0, i + 1).map(c => c.close)
    return { date: d.date, rsi: computeRSI(closes) }
  }).filter(d => d.rsi != null) || []

  const priceChange = history?.length > 1 ? ((history[history.length - 1].close / history[0].close - 1) * 100) : 0

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between animate-fadeIn">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Stock Analysis</h1>
          <p className="text-xs text-text-muted mt-1">AI-powered quantitative analysis with ML predictions</p>
        </div>
        {result && (
          <div className="flex items-center gap-2">
            <button onClick={() => toggleWatchlist(currentTicker)} className={`p-2 rounded-lg border transition-all ${watchlist.includes(currentTicker) ? 'bg-yellow/10 border-yellow/30 text-yellow' : 'bg-bg-card border-border text-text-muted hover:text-yellow hover:border-yellow/30'}`}>
              <Star className="w-4 h-4" fill={watchlist.includes(currentTicker) ? 'currentColor' : 'none'} />
            </button>
            <button onClick={exportCSV} className="p-2 rounded-lg border bg-bg-card border-border text-text-muted hover:text-accent hover:border-accent/30 transition-all" title="Export CSV">
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-3 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Enter ticker (e.g., AAPL, TSLA, NVDA)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && analyze(ticker)}
            className="w-full pl-10 pr-4 py-3 bg-bg-card border border-border rounded-xl text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all"
          />
        </div>
        <button
          onClick={() => analyze(ticker)}
          disabled={loading || !ticker.trim()}
          className="px-6 py-3 bg-gradient-to-r from-accent to-blue-600 hover:from-blue-600 hover:to-accent disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-accent/20"
        >
          <Zap className="w-4 h-4" />
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {/* Popular Tickers */}
      {!result && !loading && (
        <div className="animate-fadeIn" style={{ animationDelay: '0.15s' }}>
          <p className="text-[10px] text-text-muted uppercase tracking-widest mb-3">Popular Stocks</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {POPULAR.map(({ ticker: t, name }) => (
              <button
                key={t}
                onClick={() => { setTicker(t); analyze(t) }}
                className="bg-bg-card border border-border rounded-xl p-3 text-left hover:border-accent/30 hover:bg-accent/5 transition-all group card-glow"
              >
                <p className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors">{t}</p>
                <p className="text-[10px] text-text-muted">{name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist */}
      {watchlist.length > 0 && (
        <div className="animate-fadeIn" style={{ animationDelay: '0.2s' }}>
          <p className="text-[10px] text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Star className="w-3 h-3 text-yellow" /> Your Watchlist
          </p>
          <div className="flex flex-wrap gap-1.5">
            {watchlist.map(t => (
              <div key={t} className="flex items-center gap-1 bg-bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs">
                <button onClick={() => { setTicker(t); analyze(t) }} className="font-medium text-text-primary hover:text-accent transition-colors">{t}</button>
                <button onClick={() => toggleWatchlist(t)} className="text-text-muted hover:text-red transition-colors"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red/5 border border-red/20 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red flex-shrink-0" />
          <p className="text-sm text-red flex-1">{error}</p>
          <button onClick={() => analyze(ticker)} className="px-3 py-1.5 bg-red/10 text-red text-xs font-medium rounded-lg hover:bg-red/20 transition-colors">Retry</button>
        </div>
      )}

      {loading && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center gap-4">
            <div className="skeleton h-10 w-32" />
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <SkeletonChart />
          <SkeletonChart />
        </div>
      )}

      {result && !loading && (
        <>
          {/* Stock Header */}
          <div className="bg-bg-card border border-border rounded-xl p-5 flex items-center justify-between animate-fadeIn" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-purple/20 flex items-center justify-center border border-accent/20">
                <span className="text-lg font-bold text-accent">{currentTicker.slice(0, 2)}</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text-primary">{currentTicker}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-semibold text-text-primary">${mlData?.live_price_usd}</span>
                  <span className={`text-xs font-medium flex items-center gap-1 ${priceChange >= 0 ? 'text-green' : 'text-red'}`}>
                    {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}% (6mo)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <SignalBadge signal={mlData?.ml_recommendation} size="lg" />
              <div className="text-right">
                <p className="text-[10px] text-text-muted uppercase">Confidence</p>
                <p className="text-2xl font-bold text-accent">{(mlData?.confidence_score * 100)?.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <MetricCard label="RSI (14)" value={features.RSI_14?.toFixed(1)} color={features.RSI_14 > 70 ? 'red' : features.RSI_14 < 30 ? 'green' : undefined} sub={features.RSI_14 > 70 ? 'Overbought' : features.RSI_14 < 30 ? 'Oversold' : 'Neutral'} />
            <MetricCard label="RSI (7)" value={features.RSI_7?.toFixed(1)} color={features.RSI_7 > 70 ? 'red' : features.RSI_7 < 30 ? 'green' : undefined} />
            <MetricCard label="vs SMA50" value={`${features['Price_vs_SMA50_%']}%`} color={features['Price_vs_SMA50_%'] > 0 ? 'green' : 'red'} trend={features['Price_vs_SMA50_%']} />
            <MetricCard label="vs SMA200" value={`${features['Price_vs_SMA200_%']}%`} color={features['Price_vs_SMA200_%'] > 0 ? 'green' : 'red'} trend={features['Price_vs_SMA200_%']} />
            <MetricCard label="Volume Surge" value={`${features.Volume_Surge}x`} color={features.Volume_Surge > 1.5 ? 'orange' : features.Volume_Surge < 0.5 ? 'cyan' : undefined} sub={features.Volume_Surge > 2 ? 'Extreme' : features.Volume_Surge > 1.5 ? 'Above avg' : 'Normal'} />
            <MetricCard label="Volatility" value={`${(features.Volatility_20 * 100)?.toFixed(1)}%`} color="purple" sub="20d annualized" />
          </div>

          {/* Probability Matrix */}
          <div className="bg-bg-card border border-border rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '0.15s' }}>
            <h3 className="text-xs font-semibold text-text-primary mb-4 uppercase tracking-wider">ML Probability Matrix</h3>
            <div className="flex gap-6">
              {Object.entries(probs).map(([key, val]) => (
                <div key={key} className="flex-1">
                  <div className="flex justify-between mb-2">
                    <span className={`text-xs font-semibold ${key === 'BUY' ? 'text-green' : key === 'SELL' ? 'text-red' : 'text-yellow'}`}>{key}</span>
                    <span className="text-xs font-bold text-text-primary">{(val * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 bg-bg-primary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        key === 'BUY' ? 'bg-gradient-to-r from-green/70 to-green' : key === 'SELL' ? 'bg-gradient-to-r from-red/70 to-red' : 'bg-gradient-to-r from-yellow/70 to-yellow'
                      }`}
                      style={{ width: `${val * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Summary */}
          {result.summary && (
            <div className="bg-gradient-to-r from-accent/5 to-purple/5 border border-accent/10 rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
              <h3 className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                AI Summary
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{result.summary}</p>
            </div>
          )}

          {/* Charts */}
          {history?.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fadeIn" style={{ animationDelay: '0.25s' }}>
              <div className="bg-bg-card border border-border rounded-xl p-5 card-glow">
                <h3 className="text-xs font-semibold text-text-primary mb-4 uppercase tracking-wider">Price History (6mo)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Area type="monotone" dataKey="close" stroke="#3b82f6" fill="url(#priceGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-bg-card border border-border rounded-xl p-5 card-glow">
                <h3 className="text-xs font-semibold text-text-primary mb-4 uppercase tracking-wider">Volume</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={history.slice(-60)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Bar dataKey="volume" radius={[3, 3, 0, 0]}>
                      {history.slice(-60).map((d, i) => (
                        <rect key={i} fill={d.close >= (history[history.length - 60 + i - 1]?.close || d.close) ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {rsiData.length > 0 && (
                <div className="bg-bg-card border border-border rounded-xl p-5 lg:col-span-2 card-glow">
                  <h3 className="text-xs font-semibold text-text-primary mb-4 uppercase tracking-wider">RSI (14)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={rsiData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} ticks={[30, 50, 70]} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip {...CHART_TOOLTIP} />
                      <ReferenceLine y={70} stroke="#ef444460" strokeDasharray="3 3" />
                      <ReferenceLine y={30} stroke="#22c55e60" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="rsi" stroke="#a855f7" fill="none" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Features Grid */}
          {Object.keys(features).length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
              <h3 className="text-xs font-semibold text-text-primary mb-4 uppercase tracking-wider">All 18 ML Features</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {Object.entries(features).map(([key, val]) => (
                  <div key={key} className="bg-bg-primary rounded-lg p-3 border border-border/50 hover:border-border-bright transition-colors">
                    <p className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">{key}</p>
                    <p className="text-sm font-bold text-text-primary">{typeof val === 'number' ? val.toFixed(4) : val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function computeRSI(closes) {
  if (closes.length < 15) return null
  const recent = closes.slice(-15)
  let gains = 0, losses = 0
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1]
    if (diff > 0) gains += diff; else losses -= diff
  }
  if (losses === 0) return 100
  return 100 - 100 / (1 + gains / losses)
}
