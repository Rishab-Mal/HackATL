import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { ReweaveLogo } from '../components/ReweaveMark.jsx'

const PORTAL_HOME = { factory: '/factory', admin: '/admin', buyer: '/buyer' }

// Fabric swatches shown in the hero visual panel
const SWATCHES = [
  { hex: '#2d3f5e', fabric: 'Denim Blue',    type: 'Cotton Twill',  price: '$44',  weight: '2.3 kg' },
  { hex: '#f0ece4', fabric: 'Natural',        type: '100% Cotton',   price: '$28',  weight: '1.8 kg' },
  { hex: '#1c1c1c', fabric: 'Charcoal',      type: 'Canvas',        price: '$61',  weight: '3.1 kg' },
  { hex: '#b8a48c', fabric: 'Warm Linen',    type: 'Linen Blend',   price: '$39',  weight: '1.4 kg' },
  { hex: '#3d5a40', fabric: 'Forest',        type: 'Cotton Twill',  price: '$47',  weight: '2.0 kg' },
  { hex: '#8b7355', fabric: 'Taupe',         type: 'Wool Blend',    price: '$55',  weight: '2.7 kg' },
]

export default function LandingPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

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

  function fill(e, p) { setEmail(e); setPassword(p) }

  return (
    <div className="landing">

      {/* ── Nav ── */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <ReweaveLogo height={30} />
          </div>
          <nav className="landing-nav-links">
            <a href="#how">How it works</a>
            <a href="#workflow">Workflow</a>
          </nav>
          <button className="landing-nav-signin" onClick={() => setModalOpen(true)}>
            Sign in
          </button>
        </div>
      </header>

      {/* ── Sign-in modal ── */}
      {modalOpen && (
        <>
          <div className="landing-modal-overlay" onClick={() => setModalOpen(false)} />
          <div className="landing-modal">
            <div className="landing-modal-header">
              <div className="landing-signin-title">Sign in to your portal</div>
              <button className="landing-modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            {error && <div className="landing-signin-error">{error}</div>}
            <form onSubmit={handleSubmit} className="landing-signin-form">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email address" required className="landing-input" autoFocus />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password" required className="landing-input" />
              <button type="submit" disabled={loading} className="landing-signin-btn">
                {loading ? 'Signing in…' : 'Sign in →'}
              </button>
            </form>
            <div className="landing-demo-hints">
              <div className="landing-demo-label">Demo accounts — click to fill</div>
              <div className="landing-demo-row">
                <button className="landing-demo-fill" onClick={() => fill('factory@demo.com', 'factory123')}>Factory</button>
                <button className="landing-demo-fill" onClick={() => fill('admin@demo.com', 'admin123')}>Admin</button>
                <button className="landing-demo-fill" onClick={() => fill('buyer@demo.com', 'buyer123')}>Buyer</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-inner">

          {/* Left copy */}
          <div className="landing-hero-copy">
            <div className="landing-hero-lockup">
              <ReweaveLogo height={48} light />
            </div>
            <h1 className="landing-h1">
              Turn textile offcuts into traceable supply.
            </h1>
            <p className="landing-hero-sub">
              Reweave helps factories scan scrap fabric, create priced lots, and
              route reusable material to recyclers and makers before it becomes waste.
            </p>
            <div className="landing-hero-actions">
              <button className="landing-hero-cta" onClick={() => setModalOpen(true)}>
                Sign in to your portal →
              </button>
            </div>
          </div>

          {/* Right visual — marketplace preview */}
          <div className="landing-visual-frame">
            <div className="landing-visual-topbar">
              <span className="landing-visual-title">Marketplace lot board</span>
            </div>
            <div className="landing-visual-grid">
              {SWATCHES.map((s, i) => (
                <div key={i} className="landing-visual-card">
                  <div className="landing-visual-swatch" style={{ background: s.hex }} />
                  <div className="landing-visual-info">
                    <div className="landing-visual-fabric">{s.fabric}</div>
                    <div className="landing-visual-meta">{s.type} · {s.weight}</div>
                    <div className="landing-visual-price">{s.price}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="landing-stats-bar">
        <div className="landing-inner">
          <div className="landing-stats-grid">
            {[
              { value: 'Capture',  label: 'Factory workers photograph and register fabric offcuts.' },
              { value: 'Classify', label: 'Computer vision reads material, color, and approximate volume.' },
              { value: 'Price',    label: 'Lots receive a starting price and decay rules for faster movement.' },
              { value: 'Claim',    label: 'Buyers filter, reserve, and document the material they take.' },
            ].map((s, i) => (
              <div key={i} className="landing-stat">
                <div className="landing-stat-value">{s.value}</div>
                <div className="landing-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing-section" id="how">
        <div className="landing-inner">
          <div className="landing-section-header">
            <div className="landing-section-eyebrow">Platform overview</div>
            <h2 className="landing-h2">From factory floor to circular supply chain in three steps</h2>
          </div>
          <div className="landing-steps">
            {[
              {
                num: '01',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="7" width="22" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8"/>
                    <circle cx="14" cy="15" r="4" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M10 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8"/>
                    <circle cx="21" cy="11" r="1.2" fill="currentColor"/>
                  </svg>
                ),
                title: 'CV Capture',
                body: 'Factory workers photograph scraps on a sorting table. The vision pipeline identifies fabric type, color, composition, and estimated weight with minimal manual entry.',
              },
              {
                num: '02',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M4 20 L10 13 L15 17 L22 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19 8h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <rect x="3" y="22" width="22" height="1.5" rx="0.75" fill="currentColor" opacity="0.3"/>
                  </svg>
                ),
                title: 'AI Pricing & Listing',
                body: 'Lots are batched and priced with a time-decay model, so stale inventory becomes easier to move while suppliers keep a clear pricing floor.',
              },
              {
                num: '03',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <rect x="15" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <rect x="3" y="15" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M15 20h7M18.5 16.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                ),
                title: 'Marketplace Claim',
                body: 'Recyclers, makers, and resellers browse by fabric, color, weight, and price, then claim the material with a record of where it came from.',
              },
            ].map(s => (
              <div key={s.num} className="landing-step">
                <div className="landing-step-icon">{s.icon}</div>
                <div className="landing-step-num">{s.num}</div>
                <div className="landing-step-title">{s.title}</div>
                <div className="landing-step-body">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow ── */}
      <section className="landing-pilot" id="workflow">
        <div className="landing-inner">
          <div className="landing-pilot-eyebrow">Operational workflow</div>
          <h2 className="landing-pilot-h2">One system for factories, operators, and buyers</h2>
          <p className="landing-pilot-body">
            Reweave keeps the handoff from a factory bin to a buyer-ready lot visible.
            Each role gets the information it needs without adding extra spreadsheet work
            to the factory floor.
          </p>
          <div className="landing-pilot-stats">
            {[
              { value: 'Factory',  label: 'Capture scrap fabric without spreadsheet work.' },
              { value: 'Admin',    label: 'Review lots, approve listings, and track movement.' },
              { value: 'Buyer',    label: 'Find reusable material by specs and claim it quickly.' },
              { value: 'Impact',   label: 'Keep source, weight, price, and diversion records together.' },
            ].map((s, i) => (
              <div key={i} className="landing-pilot-stat">
                <div className="landing-pilot-stat-value">{s.value}</div>
                <div className="landing-pilot-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="landing-pilot-chain">
            Scan offcuts &nbsp;&rarr;&nbsp; classify material &nbsp;&rarr;&nbsp; publish lot &nbsp;&rarr;&nbsp; record claim
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-inner">
          <div className="landing-footer-brand">
            <ReweaveLogo height={27} light />
          </div>
          <div className="landing-footer-links">
            <a href="#how">How it works</a>
            <a href="#workflow">Workflow</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
