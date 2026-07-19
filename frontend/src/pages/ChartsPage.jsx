import { useState, useRef } from 'react'
import { BarChart3, AlertCircle, Maximize2, Minimize2 } from 'lucide-react'
import {
  ComposedChart, AreaChart, Area, Line, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine
} from 'recharts'
import { fetchStockHistory, getBacktest } from '../api/client'
import MetricCard from '../components/MetricCard'
import { SkeletonChart } from '../components/SkeletonLoader'
import { toast } from '../components/Toast'

const CHART_TOOLTIP = { contentStyle: { background: '#151b27', border: '1px solid #1e293b', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' } }

const CHART_TYPES = [
  { id: 'candle', label: 'Price' },
  { id: 'rsi', label: 'RSI' },
  { id: 'macd', label: 'MACD' },
  { id: 'vol', label: 'Volume' },
  { id: 'atr', label: 'ATR' },
]

export default function ChartsPage() {
  const [ticker, setTicker] = useState('AAPL')
  const [period, setPeriod] = useState('1y')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState(null)
  const [backtest, setBacktest] = useState(null)
  const [error, setError] = useState(null)
  const [activeCharts, setActiveCharts] = useState(new Set(['candle', 'rsi', 'macd', 'vol', 'atr']))
  const [fullscreen, setFullscreen] = useState(null)
  const containerRef = useRef(null)

  const toggleChart = (id) => {
    setActiveCharts(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleLoad = async () => {
    if (!ticker.trim()) return
    setLoading(true); setError(null); setHistory(null); setBacktest(null)
    try {
      const [hist, bt] = await Promise.all([
        fetchStockHistory(ticker.trim(), period),
        getBacktest(ticker.trim(), 2),
      ])
      setHistory(hist)
      setBacktest(bt)
      toast(`Loaded ${hist.length} data points for ${ticker}`, 'success')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const chartData = history?.map((d, i, arr) => {
    const closes = arr.slice(0, i + 1).map(c => c.close)
    const sma20 = closes.length >= 20 ? avg(closes.slice(-20)) : null
    const sma50 = closes.length >= 50 ? avg(closes.slice(-50)) : null
    let bb_upper = null, bb_lower = null
    if (closes.length >= 20) {
      const s = avg(closes.slice(-20)); const sd = stddev(closes.slice(-20))
      bb_upper = s + 2 * sd; bb_lower = s - 2 * sd
    }
    let macd = null
    if (closes.length >= 26) { macd = ema(closes, 12) - ema(closes, 26) }
    let atr = null
    if (i >= 14) {
      let trSum = 0
      for (let j = i - 13; j <= i; j++) {
        const h = arr[j].high, l = arr[j].low, pc = arr[j - 1]?.close || arr[j].close
        trSum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
      }
      atr = trSum / 14
    }
    const volSma20 = arr.slice(Math.max(0, i - 19), i + 1).reduce((s, d) => s + d.volume, 0) / Math.min(i + 1, 20)
    return { date: d.date, close: d.close, volume: d.volume, high: d.high, low: d.low, sma20, sma50, bb_upper, bb_lower, macd, atr, volSurge: volSma20 > 0 ? d.volume / volSma20 : 1 }
  }) || []

  const rsiData = history?.map((d, i) => {
    const closes = history.slice(0, i + 1).map(c => c.close)
    return { date: d.date, rsi: computeRSI(closes) }
  }).filter(d => d.rsi != null) || []

  const macdData = chartData.filter(d => d.macd != null)

  const toggleFullscreen = (chartId) => {
    setFullscreen(fullscreen === chartId ? null : chartId)
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5" ref={containerRef}>
      <div className="animate-fadeIn">
        <h1 className="text-2xl font-bold gradient-text">Statistical Charts</h1>
        <p className="text-xs text-text-muted mt-1">Technical indicators, backtesting, and strategy analysis</p>
      </div>

      {/* Controls */}
      <div className="bg-bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end animate-fadeIn" style={{ animationDelay: '0.05s' }}>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 block">Ticker</label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
            className="w-full px-3 py-2.5 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-all"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 block">Period</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2.5 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-all">
            <option value="3mo">3 Months</option>
            <option value="6mo">6 Months</option>
            <option value="1y">1 Year</option>
            <option value="2y">2 Years</option>
          </select>
        </div>

        {/* Chart toggles */}
        <div className="flex gap-1">
          {CHART_TYPES.map(ct => (
            <button
              key={ct.id}
              onClick={() => toggleChart(ct.id)}
              className={`px-3 py-2 text-[11px] font-medium rounded-lg border transition-all ${
                activeCharts.has(ct.id) ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-bg-primary border-border text-text-muted hover:text-text-secondary'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleLoad}
          disabled={loading}
          className="px-6 py-2.5 bg-gradient-to-r from-accent to-blue-600 hover:from-blue-600 hover:to-accent disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-all flex items-center gap-2 shadow-lg shadow-accent/20"
        >
          <BarChart3 className="w-4 h-4" />
          {loading ? 'Loading...' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="bg-red/5 border border-red/20 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red flex-shrink-0" />
          <p className="text-sm text-red flex-1">{error}</p>
          <button onClick={handleLoad} className="px-3 py-1.5 bg-red/10 text-red text-xs font-medium rounded-lg hover:bg-red/20 transition-colors">Retry</button>
        </div>
      )}

      {loading && (
        <div className="space-y-4 animate-fadeIn">
          <SkeletonChart /><SkeletonChart /><SkeletonChart />
        </div>
      )}

      {history && !loading && (
        <div className="space-y-4">
          {/* Price + Bollinger */}
          {activeCharts.has('candle') && (
            <ChartPanel title="Price with SMA & Bollinger Bands" subtitle="SMA 20 (cyan), SMA 50 (yellow), Bollinger Bands" id="candle" fullscreen={fullscreen} onToggle={toggleFullscreen}>
              <ResponsiveContainer width="100%" height={fullscreen === 'candle' ? 500 : 350}>
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="bbGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area dataKey="bb_upper" stroke="none" fill="url(#bbGrad)" name="BB Upper" />
                  <Area dataKey="bb_lower" stroke="none" fill="none" name="BB Lower" />
                  <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} dot={false} name="Close" />
                  <Line type="monotone" dataKey="sma20" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="SMA 20" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="sma50" stroke="#eab308" strokeWidth={1.5} dot={false} name="SMA 50" strokeDasharray="6 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* RSI */}
          {activeCharts.has('rsi') && rsiData.length > 0 && (
            <ChartPanel title="RSI (14)" id="rsi" fullscreen={fullscreen} onToggle={toggleFullscreen}>
              <ResponsiveContainer width="100%" height={fullscreen === 'rsi' ? 400 : 220}>
                <AreaChart data={rsiData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} ticks={[20, 30, 50, 70, 80]} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <ReferenceLine y={70} stroke="#ef444460" strokeDasharray="3 3" />
                  <ReferenceLine y={30} stroke="#22c55e60" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="rsi" stroke="#a855f7" fill="none" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* MACD */}
          {activeCharts.has('macd') && macdData.length > 0 && (
            <ChartPanel title="MACD (12/26/9)" id="macd" fullscreen={fullscreen} onToggle={toggleFullscreen}>
              <ResponsiveContainer width="100%" height={fullscreen === 'macd' ? 400 : 220}>
                <ComposedChart data={macdData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <ReferenceLine y={0} stroke="#64748b60" />
                  <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={2} dot={false} name="MACD" />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* Volume + ATR */}
          {(activeCharts.has('vol') || activeCharts.has('atr')) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeCharts.has('vol') && (
                <ChartPanel title="Volume Surge" id="vol" fullscreen={fullscreen} onToggle={toggleFullscreen}>
                  <ResponsiveContainer width="100%" height={fullscreen === 'vol' ? 400 : 250}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip {...CHART_TOOLTIP} />
                      <Bar dataKey="volume" fill="#3b82f6" radius={[2, 2, 0, 0]} opacity={0.5} />
                      <Line type="monotone" dataKey="volSurge" stroke="#ef4444" strokeWidth={2} dot={false} name="Vol Surge" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartPanel>
              )}
              {activeCharts.has('atr') && (
                <ChartPanel title="ATR (14)" id="atr" fullscreen={fullscreen} onToggle={toggleFullscreen}>
                  <ResponsiveContainer width="100%" height={fullscreen === 'atr' ? 400 : 250}>
                    <AreaChart data={chartData.filter(d => d.atr != null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip {...CHART_TOOLTIP} />
                      <Area type="monotone" dataKey="atr" stroke="#f97316" fill="none" strokeWidth={2} dot={false} name="ATR" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartPanel>
              )}
            </div>
          )}

          {/* Backtest */}
          {backtest && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h3 className="text-base font-bold text-text-primary">Backtest Results</h3>
                <p className="text-[10px] text-text-muted mt-0.5">ML strategy performance over 2 years</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard label="Total Return" value={`${backtest['total_return_%']}%`} color={backtest['total_return_%'] > 0 ? 'green' : 'red'} />
                <MetricCard label="Buy & Hold" value={`${backtest['buy_hold_return_%']}%`} color="blue" />
                <MetricCard label="Sharpe Ratio" value={backtest.sharpe_ratio} color={backtest.sharpe_ratio > 1 ? 'green' : 'yellow'} />
                <MetricCard label="Max Drawdown" value={`${backtest['max_drawdown_%']}%`} color="red" />
                <MetricCard label="Total Trades" value={backtest.total_trades} />
                <MetricCard label="Win Rate" value={`${backtest['win_rate_%']}%`} color={backtest['win_rate_%'] > 50 ? 'green' : 'red'} />
              </div>

              {backtest.trades?.length > 0 && (
                <div className="bg-bg-card border border-border rounded-xl p-5 card-glow">
                  <h3 className="text-xs font-semibold text-text-primary mb-4 uppercase tracking-wider">Recent Trades</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {['Date', 'Type', 'Price', 'P&L'].map(h => (
                            <th key={h} className={`p-2.5 text-text-muted text-[10px] uppercase tracking-wider font-medium ${h === 'Price' || h === 'P&L' ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {backtest.trades.map((t, i) => (
                          <tr key={i} className="border-b border-border/30 hover:bg-bg-card-hover transition-colors">
                            <td className="p-2.5 text-text-primary text-xs">{t.date}</td>
                            <td className="p-2.5 text-xs">
                              <span className={`font-semibold ${t.type.includes('BUY') ? 'text-green' : 'text-red'}`}>{t.type}</span>
                            </td>
                            <td className="p-2.5 text-right text-text-primary text-xs">${t.price}</td>
                            <td className={`p-2.5 text-right text-xs font-semibold ${t.pnl > 0 ? 'text-green' : t.pnl < 0 ? 'text-red' : 'text-text-muted'}`}>
                              {t.pnl != null ? `$${t.pnl.toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {backtest.summary && (
                <div className="bg-gradient-to-r from-accent/5 to-purple/5 border border-accent/10 rounded-xl p-5">
                  <p className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider">AI Backtest Report</p>
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{backtest.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChartPanel({ title, subtitle, id, children, fullscreen, onToggle }) {
  return (
    <div className={`bg-bg-card border border-border rounded-xl p-5 card-glow transition-all ${fullscreen && fullscreen !== id ? 'hidden' : ''} ${fullscreen === id ? 'fixed inset-0 z-40 m-0 rounded-none overflow-auto bg-bg-primary' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">{title}</h3>
          {subtitle && <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={() => onToggle(id)} className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary hover:border-border-bright transition-all">
          {fullscreen === id ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
      {children}
    </div>
  )
}

function avg(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length }
function stddev(arr) { const m = avg(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) }
function ema(data, period) { const k = 2 / (period + 1); let e = data[0]; for (let i = 1; i < data.length; i++) e = data[i] * k + e * (1 - k); return e }
function computeRSI(closes) {
  if (closes.length < 15) return null
  const r = closes.slice(-15); let g = 0, l = 0
  for (let i = 1; i < r.length; i++) { const d = r[i] - r[i - 1]; if (d > 0) g += d; else l -= d }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l)
}
