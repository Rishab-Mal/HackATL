import { createContext, useContext, useState } from 'react'
import { claimLot } from '../api.js'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  // Items: { [lotId]: { lot, buyerName, qty? } }
  // buyerName is set by Marketplace (admin assigns)
  // buyerName is null in BuyerMarketplace — checkout() receives fallback name from auth
  const [cart, setCart] = useState({})
  const [isOpen, setIsOpen] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [lastSuccess, setLastSuccess] = useState(null)

  const items = Object.values(cart)
  const total = items.reduce((s, { lot }) => s + lot.current_price_usd, 0)

  function addToCart(lot, buyerName = null, qty = null) {
    setCart(prev => ({ ...prev, [lot.id]: { lot, buyerName, qty } }))
  }

  function updateQty(lotId, qty) {
    setCart(prev => prev[lotId] ? { ...prev, [lotId]: { ...prev[lotId], qty } } : prev)
  }

  function removeFromCart(lotId) {
    setCart(prev => {
      const next = { ...prev }
      delete next[lotId]
      return next
    })
  }

  function clearCart() { setCart({}) }

  // fallbackBuyerName used for buyer self-service (BuyerMarketplace)
  async function checkout(fallbackBuyerName, onDone) {
    if (!items.length || placing) return
    setPlacing(true)
    try {
      for (const { lot, buyerName } of items) {
        await claimLot(lot.id, buyerName || fallbackBuyerName)
      }
      const count = items.length
      clearCart()
      setIsOpen(false)
      setLastSuccess(`${count} lot${count > 1 ? 's' : ''} claimed successfully.`)
      setTimeout(() => setLastSuccess(null), 5000)
      onDone?.()
    } finally {
      setPlacing(false)
    }
  }

  return (
    <CartContext.Provider value={{
      cart, items, total,
      addToCart, updateQty, removeFromCart, clearCart, checkout,
      isOpen, setIsOpen,
      placing, lastSuccess,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
