import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ChatBot from './components/ChatBot.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

import Login from './pages/Login.jsx'

// Factory portal
import Capture from './pages/Capture.jsx'
import BinFeed from './pages/factory/BinFeed.jsx'

// Admin portal
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import SortedLots from './pages/SortedLots.jsx'

// Buyer portal
import BuyerMarketplace from './pages/buyer/BuyerMarketplace.jsx'

// Shared pages still available inside portals
import Marketplace from './pages/Marketplace.jsx'
import Dashboard from './pages/Dashboard.jsx'

function PortalNav() {
  const { user, logout } = useAuth()
  if (!user) return null

  const links = {
    factory: [
      { to: '/factory', label: 'Scan', end: true },
      { to: '/factory/bins', label: 'Bin Feed' },
    ],
    admin: [
      { to: '/admin', label: 'Dashboard', end: true },
      { to: '/admin/lots', label: 'Inventory' },
      { to: '/admin/impact', label: 'Impact' },
    ],
    buyer: [
      { to: '/buyer', label: 'Browse Lots', end: true },
      { to: '/buyer/marketplace', label: 'Marketplace' },
    ],
  }

  const roleLabel = { factory: '🏭 Factory', admin: '⚙️ Admin', buyer: '🛒 Buyer' }

  return (
    <header className="nav">
      <div className="brand">🌿 Scrap Sorter <span className="portal-badge">{roleLabel[user.role]}</span></div>
      <nav>
        {(links[user.role] || []).map(l => (
          <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>
        ))}
      </nav>
      <button className="logout-btn" onClick={logout}>Sign out</button>
    </header>
  )
}

function AppInner() {
  const { user } = useAuth()
  const location = useLocation()

  // Factory routes own their own operator-focused shell.
  const isFactory = location.pathname.startsWith('/factory')

  return (
    <div className="app">
      {!isFactory && <PortalNav />}
      <main className={isFactory ? 'content content-bleed' : 'content'}>
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/login" element={user ? <Navigate to={`/${user.role}`} replace /> : <Login />} />

            {/* Factory */}
            <Route path="/factory" element={<ProtectedRoute role="factory"><Capture /></ProtectedRoute>} />
            <Route path="/factory/bins" element={<ProtectedRoute role="factory"><BinFeed /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/lots" element={<ProtectedRoute role="admin"><SortedLots /></ProtectedRoute>} />
            <Route path="/admin/impact" element={<ProtectedRoute role="admin"><Dashboard /></ProtectedRoute>} />

            {/* Buyer */}
            <Route path="/buyer" element={<ProtectedRoute role="buyer"><BuyerMarketplace /></ProtectedRoute>} />
            <Route path="/buyer/marketplace" element={<ProtectedRoute role="buyer"><Marketplace /></ProtectedRoute>} />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to={user ? `/${user.role}` : '/login'} replace />} />
            <Route path="*" element={<Navigate to={user ? `/${user.role}` : '/login'} replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
      {!isFactory && <ChatBot />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
