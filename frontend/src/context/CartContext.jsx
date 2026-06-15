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
  const total = items.reduce((s, item) => s + itemPrice(item), 0)

  function addToCart(lot, buyerName = null, qty = null) {
    const max = Number(lot.weight_kg) || 0
    const safeQty = qty == null ? max : Math.min(Math.max(Number(qty) || 0, 0), max)
    if (safeQty <= 0) return
    setCart(prev => ({ ...prev, [lot.id]: { lot, buyerName, qty: safeQty } }))
    setIsOpen(true)
  }

  function updateQty(lotId, qty) {
    const safeQty = Number(qty) || 0
    if (safeQty <= 0) return removeFromCart(lotId)
    setCart(prev => prev[lotId] ? { ...prev, [lotId]: { ...prev[lotId], qty: safeQty } } : prev)
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
      for (const { lot, buyerName, qty } of items) {
        const components = lot.component_lots?.length ? lot.component_lots : [lot]
        let remaining = qty == null ? lot.weight_kg : qty
        for (const component of components) {
          if (remaining <= 0) break
          const componentWeight = Number(component.weight_kg) || 0
          if (componentWeight <= 0) continue
          const claimQty = Math.min(remaining, componentWeight)
          await claimLot(component.id, buyerName || fallbackBuyerName, claimQty)
          remaining = Number((remaining - claimQty).toFixed(3))
        }
      }
      const count = items.length
      clearCart()
      setIsOpen(false)
      setLastSuccess(`${count} lot${count > 1 ? 's' : ''} claimed successfully.`)
      setTimeout(() => setLastSuccess(null), 5000)
      window.dispatchEvent(new CustomEvent('lots:changed'))
      onDone?.()
    } catch (err) {
      setLastSuccess(`Checkout failed: ${err?.message || 'unknown error'}`)
      setTimeout(() => setLastSuccess(null), 7000)
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

function itemPrice({ lot, qty }) {
  const totalWeight = Number(lot.weight_kg) || 0
  const totalPrice = Number(lot.current_price_usd) || 0
  if (!qty || qty >= totalWeight || totalWeight <= 0) return totalPrice
  return Number((totalPrice * (qty / totalWeight)).toFixed(2))
}
