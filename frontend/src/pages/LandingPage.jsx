import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FibrBadge, FibrIcon, FibrWordmark } from '../components/FibrMark.jsx'

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
            <FibrBadge size={28} />
            <FibrWordmark size={19} />
          </div>
          <nav className="landing-nav-links">
            <a href="#how">How it works</a>
            <a href="#pilot">Pilot</a>
            <a href="#testimonials">Partners</a>
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
            {/* Brand lockup: icon + wordmark + tagline — matches the fibr brand kit */}
            <div className="landing-hero-lockup">
              <FibrIcon size={48} />
              <div className="landing-hero-lockup-text">
                <div className="landing-hero-lockup-wordmark">fibr</div>
                <div className="landing-hero-lockup-tagline">Circular Fabric</div>
              </div>
            </div>
            <h1 className="landing-h1">
              The exchange layer<br />
              for industrial<br />
              textile waste.
            </h1>
            <p className="landing-hero-sub">
              fibr connects garment manufacturers to recyclers and makers
              through computer vision sorting, AI pricing, and a B2B marketplace.
              No middlemen. No landfill.
            </p>
            <div className="landing-hero-actions">
              <button className="landing-hero-cta" onClick={() => setModalOpen(true)}>
                Sign in to your portal →
              </button>
            </div>
            <div className="landing-trust-row">
              <span className="landing-trust-dot" />
              <span>Live pilot with Carter's</span>
              <span className="landing-trust-divider">·</span>
              <span>2,400+ kg diverted</span>
              <span className="landing-trust-divider">·</span>
              <span>18 verified buyers</span>
            </div>
          </div>

          {/* Right visual — marketplace preview */}
          <div className="landing-visual-frame">
            <div className="landing-visual-topbar">
              <span className="landing-visual-title">fibr marketplace</span>
              <span className="landing-visual-badge">6 lots available</span>
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
              { value: '2,400+', label: 'kg fabric diverted from landfill' },
              { value: '18',     label: 'verified buyers on the platform' },
              { value: '94%',    label: 'inventory sell-through rate' },
              { value: '$12K+',  label: 'revenue generated for suppliers' },
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
                body: 'Factory workers photograph scraps on a sorting table. The vision pipeline identifies fabric type, color, composition, and weight in under 30 seconds — no manual data entry.',
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
                body: 'Lots are automatically batched and priced with a time-decay model. Prices drop daily ensuring inventory turns within weeks, not months. Floor at 35% of base — always profitable.',
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
                body: 'Verified recyclers, makers, and resellers browse lots, filter by fabric and color, and claim in one click. Lots ship within 48 hours. Impact data generated automatically.',
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

      {/* ── Carter's pilot ── */}
      <section className="landing-pilot" id="pilot">
        <div className="landing-inner">
          <div className="landing-pilot-eyebrow">Running live — pilot program</div>
          <h2 className="landing-pilot-h2">Carter's Atlanta Supplier Network</h2>
          <p className="landing-pilot-body">
            Atlanta's leading childrenswear manufacturer is piloting fibr across their supplier network.
            100% cotton twill offcuts from the kids' pants line are being sorted, priced, and sold to Looptex Recyclers
            — without changing a single step on the factory floor.
          </p>
          <div className="landing-pilot-stats">
            {[
              { value: '9.5 kg',  label: 'Fabric diverted' },
              { value: '~20 kg',  label: 'CO₂ avoided' },
              { value: '4 days',  label: 'Avg. time to claim' },
              { value: '100%',    label: 'Cotton traceability' },
            ].map((s, i) => (
              <div key={i} className="landing-pilot-stat">
                <div className="landing-pilot-stat-value">{s.value}</div>
                <div className="landing-pilot-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="landing-pilot-chain">
            Carter's supplier offcuts &nbsp;&rarr;&nbsp; fibr CV pipeline &nbsp;&rarr;&nbsp; Looptex Recyclers
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="landing-section landing-section--alt" id="testimonials">
        <div className="landing-inner">
          <div className="landing-section-header">
            <div className="landing-section-eyebrow">Early feedback</div>
            <h2 className="landing-h2">What our pilot partners say</h2>
          </div>
          <div className="landing-testimonials">
            {[
              {
                quote: 'Instead of paying disposal fees on offcuts, we now have a buyer lined up before the batch even ships. It changed how we think about waste entirely.',
                name: 'Maria Chen',
                role: 'Operations Lead',
                company: 'Atlanta garment supplier',
              },
              {
                quote: "We've been buying from brokers for years. fibr gives us direct access to manufacturer offcuts at better prices and with full traceability on every lot.",
                name: 'James Osei',
                role: 'Procurement Director',
                company: 'Looptex Recyclers',
              },
              {
                quote: 'The environmental impact data is something our board actually wants to see. Real kilograms, real CO₂ numbers — not estimates. That makes the business case easy.',
                name: 'Priya Nair',
                role: 'VP Sustainability',
                company: 'Regional manufacturer',
              },
            ].map((t, i) => (
              <div key={i} className="landing-testimonial">
                <div className="landing-testimonial-mark">"</div>
                <div className="landing-testimonial-quote">{t.quote}</div>
                <div className="landing-testimonial-author">
                  <div className="landing-testimonial-name">{t.name}</div>
                  <div className="landing-testimonial-meta">{t.role} · {t.company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-inner">
          <div className="landing-footer-top">
            <div className="landing-footer-brand">
              <FibrBadge size={26} />
              <FibrWordmark size={18} light />
              <span className="landing-footer-tagline">Circular Fabric</span>
            </div>
            <div className="landing-footer-sdgs">
              <span className="landing-footer-sdg">SDG 12</span>
              <span className="landing-footer-sdg">SDG 13</span>
              <span className="landing-footer-sdg">SDG 6</span>
            </div>
          </div>
          <div className="landing-footer-meta">
            HackATL 2026 · Track 05: Make &amp; Remake · Sponsored by Carter's · Atlanta, GA
          </div>
          <div className="landing-footer-sub">
            Industrial Symbiosis &amp; Byproduct Exchange · Cox 'Play With Purpose' Hackathon
          </div>
        </div>
      </footer>

    </div>
  )
}
