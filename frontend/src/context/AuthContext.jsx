import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('scrap_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  function login(token, role, name) {
    const u = { token, role, name }
    localStorage.setItem('scrap_user', JSON.stringify(u))
    localStorage.setItem('scrap_token', token)
    setUser(u)
  }

  function logout() {
    localStorage.removeItem('scrap_user')
    localStorage.removeItem('scrap_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
