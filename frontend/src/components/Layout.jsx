import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BarChart3, GitCompare, LineChart, Brain, Activity, Search, Clock, ChevronRight, TrendingUp, Star, LogOut, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', label: 'Analysis', icon: Brain, desc: 'ML-powered stock analysis' },
  { to: '/compare', label: 'Compare', icon: GitCompare, desc: 'Multi-stock comparison' },
  { to: '/charts', label: 'Charts', icon: BarChart3, desc: 'Technical indicators' },
]

const QUICK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY']

export default function Layout() {
  const [time, setTime] = useState(new Date())
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSearch = (ticker) => {
    setSearchOpen(false)
    setSearchVal('')
    navigate(`/?ticker=${ticker}`)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-bg-secondary border-r border-border flex flex-col animate-slideInLeft">
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple flex items-center justify-center">
              <Activity className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-text-primary block leading-tight">Quant AI</span>
              <span className="text-[10px] text-text-muted">Market Intelligence</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          <p className="text-[10px] text-text-muted uppercase tracking-widest px-3 mb-2">Navigation</p>
          {navItems.map(({ to, label, icon: Icon, desc }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium shadow-[inset_0_0_0_1px_rgba(59,130,246,0.15)]'
                    : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block">{label}</span>
                <span className="text-[10px] text-text-muted group-hover:text-text-muted hidden">{desc}</span>
              </div>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}

          {/* Quick Tickers */}
          <p className="text-[10px] text-text-muted uppercase tracking-widest px-3 mt-5 mb-2 flex items-center gap-1.5">
            <Star className="w-3 h-3" /> Quick Access
          </p>
          <div className="grid grid-cols-2 gap-1 px-1">
            {QUICK_TICKERS.map(t => (
              <button
                key={t}
                onClick={() => navigate(`/?ticker=${t}`)}
                className="px-2 py-1.5 text-[11px] font-medium text-text-secondary bg-bg-card rounded-md hover:bg-bg-card-hover hover:text-text-primary transition-colors text-left"
              >
                {t}
              </button>
            ))}
          </div>
        </nav>

        {/* User Info + Logout */}
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{user?.username || 'User'}</p>
              <p className="text-[10px] text-text-muted truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:bg-red/10 hover:text-red transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            <span>18-feature RF model loaded</span>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-12 flex-shrink-0 border-b border-border bg-bg-secondary/80 backdrop-blur-sm flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-bg-card border border-border rounded-lg text-sm text-text-muted hover:border-border-bright transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search ticker...</span>
              <kbd className="text-[10px] bg-bg-primary px-1.5 py-0.5 rounded border border-border ml-4">Ctrl+K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono">{time.toLocaleTimeString('en-US', { hour12: false })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <TrendingUp className="w-3.5 h-3.5 text-green" />
              <span>Market Open</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setSearchOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-bg-secondary border border-border rounded-2xl shadow-2xl animate-fadeIn overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <Search className="w-5 h-5 text-text-muted" />
              <input
                autoFocus
                type="text"
                placeholder="Type a ticker to analyze..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchVal.trim()) handleSearch(searchVal.trim())
                  if (e.key === 'Escape') setSearchOpen(false)
                }}
                className="flex-1 bg-transparent text-text-primary text-lg outline-none placeholder:text-text-muted"
              />
              <kbd className="text-[10px] bg-bg-card px-2 py-1 rounded border border-border text-text-muted">ESC</kbd>
            </div>
            <div className="p-3">
              <p className="text-[10px] text-text-muted uppercase tracking-widest px-2 mb-2">Popular</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TICKERS.map(t => (
                  <button
                    key={t}
                    onClick={() => handleSearch(t)}
                    className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-card rounded-lg hover:bg-accent/10 hover:text-accent transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
