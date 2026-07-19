import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loginUser, registerUser, getMe } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('quantai_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      getMe(token)
        .then(u => { setUser(u); setLoading(false) })
        .catch(() => { localStorage.removeItem('quantai_token'); setToken(null); setUser(null); setLoading(false) })
    } else {
      setLoading(false)
    }
  }, [token])

  const login = useCallback(async (email, password) => {
    const data = await loginUser(email, password)
    localStorage.setItem('quantai_token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    return data
  }, [])

  const register = useCallback(async (email, username, password) => {
    const data = await registerUser(email, username, password)
    localStorage.setItem('quantai_token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('quantai_token')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
