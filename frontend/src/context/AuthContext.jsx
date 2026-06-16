import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('reweave_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  function login(token, role, name) {
    const u = { token, role, name }
    localStorage.setItem('reweave_user', JSON.stringify(u))
    localStorage.setItem('reweave_token', token)
    setUser(u)
  }

  function logout() {
    localStorage.removeItem('reweave_user')
    localStorage.removeItem('reweave_token')
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
