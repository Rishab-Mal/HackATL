import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { CartProvider, useCart } from './context/CartContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ChatBot from './components/ChatBot.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import OrderConfirmation from './components/OrderConfirmation.jsx'

import Login from './pages/Login.jsx'
import LandingPage from './pages/LandingPage.jsx'
import { ReweaveLogo } from './components/ReweaveMark.jsx'

// Factory portal
import Capture from './pages/Capture.jsx'
import BinFeed from './pages/factory/BinFeed.jsx'

// Admin portal
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import SortedLots from './pages/SortedLots.jsx'

// Buyer portal
import BuyerMarketplace from './pages/buyer/BuyerMarketplace.jsx'
import BuyerOrders from './pages/buyer/BuyerOrders.jsx'

// Shared pages still available inside portals
import Dashboard from './pages/Dashboard.jsx'
import { formatMoney, formatWeightKg } from './utils/formatters.js'

function CartButton() {
  const { items, total, isOpen, setIsOpen } = useCart()
  if (items.length === 0) return null
  return (
    <button
      className="nav-cart-btn"
      onClick={() => setIsOpen(o => !o)}
      aria-label="Open cart"
    >
      <span className="nav-cart-badge">{items.length}</span>
      <span style={{ fontSize: 12 }}>Order &nbsp;·&nbsp; {formatMoney(total)}</span>
    </button>
  )
}

function cartItemPrice({ lot, qty }) {
  const totalWeight = Number(lot.weight_kg) || 0
  const totalPrice = Number(lot.current_price_usd) || 0
  if (!qty || qty >= totalWeight || totalWeight <= 0) return totalPrice
  return Number((totalPrice * (qty / totalWeight)).toFixed(4))
}

function CheckoutPanel() {
  const { user } = useAuth()
  const { items, total, removeFromCart, checkout, isOpen, setIsOpen, placing } = useCart()
  if (!isOpen) return null

  return (
    <>
      <div className="checkout-overlay" onClick={() => setIsOpen(false)} />
      <div className="checkout-panel">
        <div className="checkout-header">
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--c-muted)', marginBottom: 2 }}>
              Order Summary
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
              Cart · {items.length} lot{items.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button className="chat-close" onClick={() => setIsOpen(false)}>✕</button>
        </div>

        <div className="checkout-items">
          {items.map(({ lot, buyerName, qty }) => (
            <div className="checkout-item" key={lot.id}>
              <div className="checkout-swatch" style={{ background: lot.color_hex }} />
              <div className="checkout-item-info">
                <div className="checkout-item-name">{lot.name}</div>
                {buyerName
                  ? <div className="checkout-item-buyer">→ {buyerName}</div>
                  : <div className="checkout-item-buyer">→ {user?.name}</div>
                }
                <div className="checkout-item-meta">
                  {lot.fabric_type} · {formatWeightKg(qty || lot.weight_kg)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="checkout-item-price">{formatMoney(cartItemPrice({ lot, qty }))}</div>
                <button className="cart-remove" style={{ marginTop: 4 }} onClick={() => removeFromCart(lot.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="checkout-footer">
          <div className="checkout-total-row">
            <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>
              {items.length} lot{items.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text)', letterSpacing: '-0.5px' }}>
              {formatMoney(total)}
            </span>
          </div>
          <button
            className="checkout-btn"
            onClick={() => checkout(user?.name)}
            disabled={placing}
          >
            {placing ? 'Processing…' : 'Confirm & Claim All →'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--c-muted)', margin: '8px 0 0', textAlign: 'center' }}>
            Lots will be marked as claimed immediately.
          </p>
        </div>
      </div>
    </>
  )
}

function PortalNav() {
  const { user, logout } = useAuth()
  if (!user) return null

  const links = {
    factory: [
      { to: '/factory', label: 'Capture', end: true },
      { to: '/factory/bins', label: 'Live Bins' },
    ],
    admin: [
      { to: '/admin', label: 'Operations', end: true },
      { to: '/admin/lots', label: 'Inventory' },
      { to: '/admin/impact', label: 'Impact' },
    ],
    buyer: [
      { to: '/buyer', label: 'Marketplace', end: true },
      { to: '/buyer/orders', label: 'My Orders' },
    ],
  }

  const roleLabel = { factory: 'Factory', admin: 'Admin', buyer: 'Buyer' }

  return (
    <header className="nav">
      <div className="brand">
        <ReweaveLogo height={28} light />
        <span className="portal-badge">{roleLabel[user.role]}</span>
      </div>
      <nav>
        {(links[user.role] || []).map(l => (
          <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>
        ))}
      </nav>
      <div className="nav-right">
        {user.role === 'buyer' && <CartButton />}
        <button className="logout-btn" onClick={logout}>Sign out</button>
      </div>
    </header>
  )
}

function AppInner() {
  const { user } = useAuth()
  const location = useLocation()
  const { lastSuccess, lastOrder, clearLastOrder } = useCart()

  // Factory routes use their own full-screen operator shell (FactoryHeader + dark UI)
  const isFactory = location.pathname.startsWith('/factory')

  // Landing page gets its own full-screen layout — no portal chrome, no content wrapper
  const isLanding = !user && (location.pathname === '/' || location.pathname === '/login')
  if (isLanding) {
    return <LandingPage />
  }

  return (
    <div className="app">
      {!isFactory && <PortalNav />}
      {lastSuccess && (
        <div className="global-success-banner">{lastSuccess}</div>
      )}
      <main className={isFactory ? 'content content-bleed' : 'content'}>
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/login" element={user ? <Navigate to={`/${user.role}`} replace /> : <LandingPage />} />

            {/* Factory */}
            <Route path="/factory" element={<ProtectedRoute role="factory"><Capture /></ProtectedRoute>} />
            <Route path="/factory/bins" element={<ProtectedRoute role="factory"><BinFeed /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/lots" element={<ProtectedRoute role="admin"><SortedLots /></ProtectedRoute>} />
            <Route path="/admin/impact" element={<ProtectedRoute role="admin"><Dashboard /></ProtectedRoute>} />

            {/* Buyer */}
            <Route path="/buyer" element={<ProtectedRoute role="buyer"><BuyerMarketplace /></ProtectedRoute>} />
            <Route path="/buyer/orders" element={<ProtectedRoute role="buyer"><BuyerOrders /></ProtectedRoute>} />

            {/* Root: landing page for guests, portal home for authed users */}
            <Route path="/" element={user ? <Navigate to={`/${user.role}`} replace /> : <LandingPage />} />
            <Route path="*" element={<Navigate to={user ? `/${user.role}` : '/'} replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <CheckoutPanel />
      {lastOrder && <OrderConfirmation order={lastOrder} onClose={clearLastOrder} />}
      {!isFactory && <ChatBot />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppInner />
      </CartProvider>
    </AuthProvider>
  )
}
