import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const PORTAL_HOME = { factory: '/factory', admin: '/admin', buyer: '/buyer' }

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Login failed')
      }
      const data = await res.json()
      login(data.access_token, data.role, data.name)
      navigate(PORTAL_HOME[data.role] ?? '/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">R</div>
          Reweave
        </div>
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">Enter your portal credentials to continue.</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@demo.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-hints">
          <p className="muted">Demo accounts:</p>
          <div className="hint-grid">
            <span>factory@demo.com</span><span className="muted">/ factory123</span>
            <span>admin@demo.com</span><span className="muted">/ admin123</span>
            <span>buyer@demo.com</span><span className="muted">/ buyer123</span>
          </div>
        </div>
      </div>
    </div>
  )
}
