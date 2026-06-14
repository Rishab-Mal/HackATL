import { Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import ChatBot from './components/ChatBot.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Capture from './pages/Capture.jsx'
import SortedLots from './pages/SortedLots.jsx'
import Marketplace from './pages/Marketplace.jsx'
import Dashboard from './pages/Dashboard.jsx'

export default function App() {
  const location = useLocation()

  return (
    <div className="app">
      <Nav />
      <main className="content">
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<Capture />} />
            <Route path="/lots" element={<SortedLots />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <ChatBot />
    </div>
  )
}
