import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Activity, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, username, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-purple flex items-center justify-center mx-auto mb-4">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Create account</h1>
          <p className="text-sm text-text-muted mt-1">Start using Quant AI</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red/10 border border-red/20 text-red text-sm px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="w-full bg-bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent transition-colors placeholder:text-text-muted"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent transition-colors placeholder:text-text-muted"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type={showPw ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full bg-bg-card border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-text-primary outline-none focus:border-accent transition-colors placeholder:text-text-muted"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
