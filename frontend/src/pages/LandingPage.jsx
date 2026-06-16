import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FibrBadge, FibrIcon, FibrWordmark } from '../components/FibrMark.jsx'

const PORTAL_HOME = { factory: '/factory', admin: '/admin', buyer: '/buyer' }

const SWATCHES = [
  { hex: '#2d3f5e', fabric: 'Denim Blue',  type: 'Cotton Twill', price: '$44', weight: '2.3 kg' },
  { hex: '#f0ece4', fabric: 'Natural',      type: '100% Cotton',  price: '$28', weight: '1.8 kg' },
  { hex: '#1c1c1c', fabric: 'Charcoal',    type: 'Canvas',       price: '$61', weight: '3.1 kg' },
  { hex: '#b8a48c', fabric: 'Warm Linen',  type: 'Linen Blend',  price: '$39', weight: '1.4 kg' },
  { hex: '#3d5a40', fabric: 'Forest',      type: 'Cotton Twill', price: '$47', weight: '2.0 kg' },
  { hex: '#8b7355', fabric: 'Taupe',       type: 'Wool Blend',   price: '$55', weight: '2.7 kg' },
]

const STEPS = [
  {
    num: '01',
    title: 'CV Capture',
    sub: 'Factory floor',
    body: 'Workers photograph scraps on a sorting table. Computer vision identifies fabric type, color, composition, and weight in under 30 seconds — no manual data entry, no labeling.',
    detail: ['Detects color groups automatically', 'Estimates weight per group', 'Assigns sort bin letter instantly', 'Lists lots to marketplace in real time'],
    visual: 'cv',
  },
  {
    num: '02',
    title: 'AI Pricing & Listing',
    sub: 'Automatic',
    body: 'Lots are priced with a time-decay model that drops prices daily, floor at 35% of base. Inventory turns in weeks, not months. The longer it sits, the more competitive the price.',
    detail: ['Exponential decay from day 7', 'Floor at 35% — always profitable', 'Admin decay alerts for aging lots', 'One-click delist / relist control'],
    visual: 'pricing',
  },
  {
    num: '03',
    title: 'Marketplace Claim',
    sub: 'Buyer portal',
    body: 'Verified recyclers, makers, and resellers browse lots, filter by fabric and color, and claim with a quantity slider. Lots ship within 48 hours. Impact data generated automatically.',
    detail: ['Filter by fabric type and color', 'Quantity slider — buy partial lots', 'CO₂ + water savings per lot', 'Real-time inventory availability'],
    visual: 'marketplace',
  },
]

const TESTIMONIALS = [
  {
    quote: 'Instead of paying disposal fees on offcuts, we now have a buyer lined up before the batch even ships. It changed how we think about waste entirely.',
    name: 'Maria Chen',
    role: 'Operations Lead',
    company: 'Atlanta garment supplier',
    initials: 'MC',
  },
  {
    quote: "We've been buying from brokers for years. fibr gives us direct access to manufacturer offcuts at better prices and with full traceability on every lot.",
    name: 'James Osei',
    role: 'Procurement Director',
    company: 'Looptex Recyclers',
    initials: 'JO',
  },
  {
    quote: 'The environmental impact data is something our board actually wants to see. Real kilograms, real CO₂ numbers — not estimates. That makes the business case easy.',
    name: 'Priya Nair',
    role: 'VP Sustainability',
    company: 'Regional manufacturer',
    initials: 'PN',
  },
]

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCountUp(target, duration, inView) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!inView || target === 0) return
    let current = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      current += step
      if (current >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(current))
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration, inView])
  return count
}

function useInView(ref, threshold = 0.3) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref, threshold])
  return inView
}

// ── Step carousel visuals ────────────────────────────────────────────────────
function CVVisual() {
  return (
    <div className="lp-visual-cv">
      <div className="lp-cv-topbar">
        <span className="lp-cv-dot" style={{ background: '#ef4444' }} />
        <span className="lp-cv-dot" style={{ background: '#f59e0b' }} />
        <span className="lp-cv-dot" style={{ background: '#22c55e' }} />
        <span className="lp-cv-title">fibr — factory scan</span>
      </div>
      <div className="lp-cv-frame">
        <div className="lp-cv-table">
          {[
            { hex: '#2d3f5e', x: '8%',  y: '12%', w: '32%', h: '28%', label: 'A' },
            { hex: '#b8a48c', x: '48%', y: '10%', w: '22%', h: '22%', label: 'B' },
            { hex: '#1c1c1c', x: '12%', y: '52%', w: '28%', h: '24%', label: 'C' },
            { hex: '#3d5a40', x: '50%', y: '44%', w: '34%', h: '30%', label: 'D' },
            { hex: '#8b7355', x: '75%', y: '12%', w: '18%', h: '26%', label: 'E' },
          ].map(s => (
            <div key={s.label} className="lp-cv-scrap" style={{
              background: s.hex, left: s.x, top: s.y, width: s.w, height: s.h
            }}>
              <span className="lp-cv-scrap-label">{s.label}</span>
            </div>
          ))}
          <div className="lp-cv-scan-line" />
        </div>
        <div className="lp-cv-readout">
          <span className="lp-cv-readout-dot" />
          <span>Grouping colors — 5 groups found</span>
        </div>
      </div>
      <div className="lp-cv-groups">
        {[
          { hex: '#2d3f5e', name: 'Denim Blue', bin: 'Bin A', count: '3 pcs' },
          { hex: '#1c1c1c', name: 'Charcoal',   bin: 'Bin C', count: '2 pcs' },
          { hex: '#3d5a40', name: 'Forest',      bin: 'Bin B', count: '4 pcs' },
        ].map(g => (
          <div key={g.name} className="lp-cv-group-row">
            <span className="lp-cv-group-swatch" style={{ background: g.hex }} />
            <span className="lp-cv-group-name">{g.name}</span>
            <span className="lp-cv-group-bin">{g.bin}</span>
            <span className="lp-cv-group-count">{g.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PricingVisual() {
  const pts = [100, 98, 95, 90, 83, 74, 63, 52, 43, 37, 35, 35, 35]
  const w = 260, h = 120
  const xStep = w / (pts.length - 1)
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${i * xStep},${h - (p / 100) * h}`).join(' ')
  const areaD = pathD + ` L${(pts.length - 1) * xStep},${h} L0,${h} Z`

  return (
    <div className="lp-visual-pricing">
      <div className="lp-cv-topbar">
        <span className="lp-cv-dot" style={{ background: '#ef4444' }} />
        <span className="lp-cv-dot" style={{ background: '#f59e0b' }} />
        <span className="lp-cv-dot" style={{ background: '#22c55e' }} />
        <span className="lp-cv-title">fibr — AI pricing</span>
      </div>
      <div className="lp-pricing-body">
        <div className="lp-pricing-header">
          <div>
            <div className="lp-pricing-lot-name">Navy Cotton Twill · Lot #038</div>
            <div className="lp-pricing-lot-meta">Listed 11 days ago · 2.3 kg · 4 pcs</div>
          </div>
          <div className="lp-pricing-badge">−37%</div>
        </div>
        <svg width={w} height={h + 20} viewBox={`0 0 ${w} ${h + 20}`} className="lp-pricing-chart">
          <defs>
            <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#166534" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#166534" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#pg)" />
          <path d={pathD} fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="0" y1={h - 0.35 * h} x2={w} y2={h - 0.35 * h} stroke="#dc2626" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
          <text x={w - 4} y={h - 0.35 * h - 4} textAnchor="end" fontSize="9" fill="#dc2626" opacity="0.7">floor 35%</text>
        </svg>
        <div className="lp-pricing-price-row">
          <div>
            <span className="lp-pricing-current">$27.65</span>
            <span className="lp-pricing-original">was $44.00</span>
          </div>
          <div className="lp-pricing-decay-note">Drops daily until claimed</div>
        </div>
      </div>
    </div>
  )
}

function MarketplaceVisual() {
  return (
    <div className="lp-visual-marketplace">
      <div className="lp-cv-topbar">
        <span className="lp-cv-dot" style={{ background: '#ef4444' }} />
        <span className="lp-cv-dot" style={{ background: '#f59e0b' }} />
        <span className="lp-cv-dot" style={{ background: '#22c55e' }} />
        <span className="lp-cv-title">fibr — buyer marketplace</span>
      </div>
      <div className="lp-mkt-grid">
        {[
          { hex: '#2d3f5e', name: 'Navy Cotton Twill',  price: '$44',  decay: '-18%', type: 'Cotton' },
          { hex: '#3d5a40', name: 'Forest Canvas',      price: '$47',  decay: '-8%',  type: 'Canvas' },
          { hex: '#b8a48c', name: 'Warm Linen Blend',   price: '$28',  decay: '-33%', type: 'Linen'  },
          { hex: '#1c1c1c', name: 'Charcoal Cotton',    price: '$61',  decay: '-5%',  type: 'Cotton' },
        ].map(c => (
          <div key={c.name} className="lp-mkt-card">
            <div className="lp-mkt-swatch" style={{ background: c.hex }}>
              <span className="lp-mkt-type-tag">{c.type}</span>
            </div>
            <div className="lp-mkt-info">
              <div className="lp-mkt-name">{c.name}</div>
              <div className="lp-mkt-price-row">
                <span className="lp-mkt-price">{c.price}</span>
                <span className="lp-mkt-decay">{c.decay}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="lp-mkt-cta">
        <span className="lp-mkt-cta-btn">Add to Order</span>
        <span className="lp-mkt-impact">4.1 kg CO₂ saved</span>
      </div>
    </div>
  )
}

const VISUALS = { cv: CVVisual, pricing: PricingVisual, marketplace: MarketplaceVisual }

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [activeTesti, setActiveTesti] = useState(0)
  const touchStartX = useRef(null)

  const statsRef = useRef(null)
  const statsInView = useInView(statsRef)

  // stat count-ups
  const kg     = useCountUp(2400,  1400, statsInView)
  const buyers = useCountUp(18,    900,  statsInView)
  const pct    = useCountUp(94,    1100, statsInView)
  const rev    = useCountUp(12,    1300, statsInView)

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

  // Step carousel swipe
  function onStepTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onStepTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta < -50) setActiveStep(s => Math.min(s + 1, STEPS.length - 1))
    if (delta > 50)  setActiveStep(s => Math.max(s - 1, 0))
    touchStartX.current = null
  }

  // Testimonial carousel
  const testiTouchStart = useRef(null)
  function onTestiTouchStart(e) { testiTouchStart.current = e.touches[0].clientX }
  function onTestiTouchEnd(e) {
    if (testiTouchStart.current === null) return
    const delta = e.changedTouches[0].clientX - testiTouchStart.current
    if (delta < -50) setActiveTesti(s => Math.min(s + 1, TESTIMONIALS.length - 1))
    if (delta > 50)  setActiveTesti(s => Math.max(s - 1, 0))
    testiTouchStart.current = null
  }

  const StepVisual = VISUALS[STEPS[activeStep].visual]

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
            <a href="#impact">Impact</a>
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
          <div className="landing-hero-copy">
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
              <a href="#how" className="landing-hero-ghost">See how it works</a>
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

      {/* ── Animated stats bar ── */}
      <section className="landing-stats-bar" ref={statsRef}>
        <div className="landing-inner">
          <div className="landing-stats-grid">
            <div className="landing-stat">
              <div className="landing-stat-value">{statsInView ? `${kg.toLocaleString()}+` : '—'}</div>
              <div className="landing-stat-label">kg fabric diverted from landfill</div>
            </div>
            <div className="landing-stat">
              <div className="landing-stat-value">{statsInView ? buyers : '—'}</div>
              <div className="landing-stat-label">verified buyers on the platform</div>
            </div>
            <div className="landing-stat">
              <div className="landing-stat-value">{statsInView ? `${pct}%` : '—'}</div>
              <div className="landing-stat-label">inventory sell-through rate</div>
            </div>
            <div className="landing-stat">
              <div className="landing-stat-value">{statsInView ? `$${rev}K+` : '—'}</div>
              <div className="landing-stat-label">revenue generated for suppliers</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Swipeable Platform Carousel ── */}
      <section className="landing-section lp-carousel-section" id="how">
        <div className="landing-inner">
          <div className="landing-section-header">
            <div className="landing-section-eyebrow">Platform overview</div>
            <h2 className="landing-h2">From factory floor to circular supply chain</h2>
            <p className="lp-section-sub">Swipe or click the arrows to explore each step</p>
          </div>
        </div>

        <div
          className="lp-carousel"
          onTouchStart={onStepTouchStart}
          onTouchEnd={onStepTouchEnd}
        >
          <div className="lp-carousel-track" style={{ transform: `translateX(calc(-${activeStep * 100}% - ${activeStep * 0}px))` }}>
            {STEPS.map((step, i) => (
              <div key={step.num} className={`lp-carousel-slide ${i === activeStep ? 'lp-carousel-slide--active' : ''}`}>
                <div className="lp-carousel-inner">
                  <div className="lp-carousel-copy">
                    <div className="lp-carousel-num">{step.num}</div>
                    <div className="lp-carousel-sub">{step.sub}</div>
                    <h3 className="lp-carousel-title">{step.title}</h3>
                    <p className="lp-carousel-body">{step.body}</p>
                    <ul className="lp-carousel-features">
                      {step.detail.map(d => (
                        <li key={d}>
                          <span className="lp-carousel-check">✓</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="lp-carousel-visual">
                    {i === activeStep && <StepVisual />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lp-carousel-controls">
          <button
            className="lp-carousel-arrow"
            onClick={() => setActiveStep(s => Math.max(s - 1, 0))}
            disabled={activeStep === 0}
          >←</button>
          <div className="lp-carousel-dots">
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={`lp-carousel-dot ${i === activeStep ? 'lp-carousel-dot--active' : ''}`}
                onClick={() => setActiveStep(i)}
              />
            ))}
          </div>
          <button
            className="lp-carousel-arrow"
            onClick={() => setActiveStep(s => Math.min(s + 1, STEPS.length - 1))}
            disabled={activeStep === STEPS.length - 1}
          >→</button>
        </div>
      </section>

      {/* ── Impact section (dark) ── */}
      <section className="lp-impact" id="impact">
        <div className="landing-inner">
          <div className="lp-impact-eyebrow">Environmental impact</div>
          <h2 className="lp-impact-h2">Every lot claimed is waste that never reaches landfill</h2>
          <div className="lp-impact-grid">
            {[
              { value: '2,400+', unit: 'kg', label: 'Fabric diverted from landfill', icon: '♻' },
              { value: '5,040', unit: 'kg CO₂', label: 'Carbon emissions avoided', icon: '🌿' },
              { value: '6.48M', unit: 'L', label: 'Water saved vs. new production', icon: '💧' },
              { value: '94%', unit: '', label: 'Sell-through rate — near-zero waste', icon: '📈' },
            ].map((s, i) => (
              <div key={i} className="lp-impact-stat">
                <div className="lp-impact-icon">{s.icon}</div>
                <div className="lp-impact-value">{s.value}<span className="lp-impact-unit">{s.unit}</span></div>
                <div className="lp-impact-label">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="lp-impact-note">
            Calculated using HIGG index: 2.1 kg CO₂ per kg fabric, 2,700 L water per kg.
            Numbers reflect active fibr pilot data from Carter's supplier network.
          </p>
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

      {/* ── Testimonials carousel ── */}
      <section className="landing-section landing-section--alt">
        <div className="landing-inner">
          <div className="landing-section-header">
            <div className="landing-section-eyebrow">Early feedback</div>
            <h2 className="landing-h2">What our pilot partners say</h2>
          </div>

          <div
            className="lp-testi-wrap"
            onTouchStart={onTestiTouchStart}
            onTouchEnd={onTestiTouchEnd}
          >
            <div className="lp-testi-track" style={{ transform: `translateX(-${activeTesti * 100}%)` }}>
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="lp-testi-slide">
                  <div className="lp-testi-card">
                    <div className="landing-testimonial-mark">"</div>
                    <div className="landing-testimonial-quote">{t.quote}</div>
                    <div className="lp-testi-author">
                      <div className="lp-testi-avatar">{t.initials}</div>
                      <div>
                        <div className="landing-testimonial-name">{t.name}</div>
                        <div className="landing-testimonial-meta">{t.role} · {t.company}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-testi-dots">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                className={`lp-carousel-dot ${i === activeTesti ? 'lp-carousel-dot--active' : ''}`}
                onClick={() => setActiveTesti(i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA block ── */}
      <section className="lp-cta-block">
        <div className="landing-inner lp-cta-inner">
          <div className="lp-cta-text">
            <h2 className="lp-cta-h2">Ready to turn waste into value?</h2>
            <p className="lp-cta-sub">Join the fibr pilot. Set up in under a day — no hardware, no process changes, no contracts.</p>
          </div>
          <div className="lp-cta-actions">
            <button className="landing-hero-cta" onClick={() => setModalOpen(true)}>
              Sign in to your portal →
            </button>
            <div className="lp-cta-hint">Demo: factory · admin · buyer</div>
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
