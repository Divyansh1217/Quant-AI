import { useState } from 'react'
import { Plus, X, GitCompare, AlertCircle, Zap, BarChart3 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { getPortfolio, fetchStockHistory } from '../api/client'
import SignalBadge from '../components/SignalBadge'
import { SkeletonCard, SkeletonChart } from '../components/SkeletonLoader'
import { toast } from '../components/Toast'

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#eab308', '#a855f7', '#06b6d4', '#f97316', '#ec4899']
const PRESETS = [
  { label: 'FAANG+', tickers: ['META', 'AMZN', 'AAPL', 'NFLX', 'GOOGL'] },
  { label: 'AI Chips', tickers: ['NVDA', 'AMD', 'AVGO', 'MU', 'QCOM'] },
  { label: 'Cloud', tickers: ['MSFT', 'AMZN', 'GOOGL', 'CRM', 'SNOW'] },
  { label: 'S&P Top 5', tickers: ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL'] },
]
const CHART_TOOLTIP = { contentStyle: { background: '#151b27', border: '1px solid #1e293b', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' } }

export default function ComparisonPage() {
  const [tickers, setTickers] = useState(['AAPL', 'MSFT'])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [priceData, setPriceData] = useState(null)
  const [error, setError] = useState(null)

  const addTicker = () => {
    const t = input.trim().toUpperCase()
    if (t && !tickers.includes(t) && tickers.length < 8) {
      setTickers([...tickers, t]); setInput('')
    }
  }

  const removeTicker = (t) => setTickers(tickers.filter(x => x !== t))

  const loadPreset = (preset) => {
    setTickers(preset.tickers)
    toast(`Loaded ${preset.label} preset`, 'info')
  }

  const handleCompare = async () => {
    if (tickers.length < 2) return
    setLoading(true); setError(null); setResult(null); setPriceData(null)
    try {
      const [portfolio, ...histories] = await Promise.all([
        getPortfolio(tickers),
        ...tickers.map(t => fetchStockHistory(t, '6mo')),
      ])
      setResult(portfolio)
      const allDates = [...new Set(histories.flatMap(h => h.map(d => d.date)))]
      const normalized = allDates.map(date => {
        const point = { date }
        histories.forEach((h, idx) => {
          const match = h.find(d => d.date === date)
          const base = h[0]?.close || 1
          if (match) point[tickers[idx]] = ((match.close / base - 1) * 100).toFixed(2)
        })
        return point
      })
      setPriceData(normalized)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const signals = result?.individual_signals || {}
  const corrMatrix = result?.correlation_matrix || {}

  // Radar chart data
  const radarData = Object.entries(signals).map(([t, data]) => ({
    ticker: t,
    rsi: Math.min(100, Math.max(0, data.rsi_14 || 50)),
    momentum: Math.min(100, Math.max(0, (data['price_vs_sma50_%'] || 0) + 50)),
    return1m: Math.min(100, Math.max(0, (data['1mo_return_%'] || 0) * 5 + 50)),
  }))

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="animate-fadeIn">
        <h1 className="text-2xl font-bold gradient-text">Stock Comparison</h1>
        <p className="text-xs text-text-muted mt-1">Compare stocks with correlation analysis and normalized performance</p>
      </div>

      {/* Input */}
      <div className="bg-bg-card border border-border rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '0.05s' }}>
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => loadPreset(p)} className="px-3 py-1 text-[10px] font-medium text-text-muted bg-bg-primary border border-border rounded-full hover:text-accent hover:border-accent/30 transition-all">
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {tickers.map((t, i) => (
            <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-sm font-medium text-text-primary animate-fadeIn">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              {t}
              <button onClick={() => removeTicker(t)} className="ml-0.5 text-text-muted hover:text-red transition-colors"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add ticker..."
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && addTicker()}
            className="flex-1 max-w-xs px-3 py-2.5 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-all"
          />
          <button onClick={addTicker} className="px-4 py-2.5 bg-bg-primary border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-all flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add
          </button>
          <button
            onClick={handleCompare}
            disabled={loading || tickers.length < 2}
            className="px-6 py-2.5 bg-gradient-to-r from-accent to-blue-600 hover:from-blue-600 hover:to-accent disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-all flex items-center gap-2 shadow-lg shadow-accent/20"
          >
            <GitCompare className="w-4 h-4" />
            {loading ? 'Comparing...' : 'Compare'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red/5 border border-red/20 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red flex-shrink-0" />
          <p className="text-sm text-red flex-1">{error}</p>
          <button onClick={handleCompare} className="px-3 py-1.5 bg-red/10 text-red text-xs font-medium rounded-lg hover:bg-red/20 transition-colors">Retry</button>
        </div>
      )}

      {loading && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 gap-3"><SkeletonCard /><SkeletonCard /></div>
          <SkeletonChart />
        </div>
      )}

      {result && !loading && (
        <>
          {/* Diversification */}
          <div className="bg-gradient-to-r from-accent/5 to-purple/5 border border-accent/10 rounded-xl p-5 flex items-center justify-between animate-fadeIn">
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Diversification Score</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{result.diversification_score}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Avg Correlation</p>
              <p className="text-2xl font-bold text-accent">{result.average_correlation}</p>
            </div>
          </div>

          {/* Performance Chart */}
          {priceData && (
            <div className="bg-bg-card border border-border rounded-xl p-5 card-glow animate-fadeIn" style={{ animationDelay: '0.1s' }}>
              <h3 className="text-xs font-semibold text-text-primary mb-4 uppercase tracking-wider">Normalized Performance (% Change)</h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={priceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {tickers.map((t, i) => (
                    <Line key={t} type="monotone" dataKey={t} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Radar Chart */}
          {radarData.length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-5 card-glow animate-fadeIn" style={{ animationDelay: '0.12s' }}>
              <h3 className="text-xs font-semibold text-text-primary mb-4 uppercase tracking-wider">Stock Profile Radar</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1e293b" />
                  <PolarAngleAxis dataKey="ticker" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <PolarRadiusAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Radar name="RSI" dataKey="rsi" stroke="#a855f7" fill="#a855f7" fillOpacity={0.15} />
                  <Radar name="Momentum" dataKey="momentum" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                  <Radar name="1M Return" dataKey="return1m" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip {...CHART_TOOLTIP} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Individual Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(signals).map(([t, data], i) => (
              <div key={t} className="bg-bg-card border border-border rounded-xl p-5 card-glow animate-fadeIn transition-all hover:border-border-bright" style={{ animationDelay: `${0.15 + i * 0.03}s` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <h4 className="text-base font-bold text-text-primary">{t}</h4>
                  </div>
                  <span className="text-lg font-bold text-text-primary">${data.price}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-bg-primary rounded-lg p-2">
                    <p className="text-[9px] text-text-muted uppercase">RSI 14</p>
                    <p className={`text-sm font-bold ${data.rsi_14 > 70 ? 'text-red' : data.rsi_14 < 30 ? 'text-green' : 'text-text-primary'}`}>{data.rsi_14}</p>
                  </div>
                  <div className="bg-bg-primary rounded-lg p-2">
                    <p className="text-[9px] text-text-muted uppercase">vs SMA50</p>
                    <p className={`text-sm font-bold ${data['price_vs_sma50_%'] > 0 ? 'text-green' : 'text-red'}`}>{data['price_vs_sma50_%']}%</p>
                  </div>
                  <div className="bg-bg-primary rounded-lg p-2">
                    <p className="text-[9px] text-text-muted uppercase">1mo Ret</p>
                    <p className={`text-sm font-bold ${data['1mo_return_%'] > 0 ? 'text-green' : 'text-red'}`}>{data['1mo_return_%']}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Correlation Heatmap */}
          {Object.keys(corrMatrix).length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
              <h3 className="text-xs font-semibold text-text-primary mb-4 uppercase tracking-wider">Correlation Matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="p-2"></th>
                      {tickers.map(t => <th key={t} className="p-2 text-center text-text-muted text-xs font-medium">{t}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {tickers.map(row => (
                      <tr key={row}>
                        <td className="p-2 text-text-primary font-medium text-xs">{row}</td>
                        {tickers.map(col => {
                          const val = corrMatrix[row]?.[col]
                          const bg = val != null ? getCorrColor(val) : ''
                          return (
                            <td key={col} className={`p-2 text-center text-xs font-mono rounded-lg ${bg} transition-colors`}>
                              {val != null ? val.toFixed(2) : '-'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Summary */}
          {result.summary && (
            <div className="bg-gradient-to-r from-accent/5 to-purple/5 border border-accent/10 rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '0.25s' }}>
              <h3 className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" /> AI Portfolio Summary
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{result.summary}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function getCorrColor(val) {
  if (val > 0.7) return 'bg-green/20 text-green'
  if (val > 0.3) return 'bg-green/10 text-green/70'
  if (val > -0.3) return 'bg-bg-primary text-text-muted'
  if (val > -0.7) return 'bg-red/10 text-red/70'
  return 'bg-red/20 text-red'
}
