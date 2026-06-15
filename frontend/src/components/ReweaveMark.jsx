// Shared Reweave logo components.

export function ReweaveBadge({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#1a2d4f"/>
      <path
        d="M11 31.5V8.5h11.2c5.1 0 8.3 2.9 8.3 7.3 0 3.2-1.7 5.5-4.7 6.5l5.3 9.2h-6.2l-4.7-8.3h-3.6v8.3H11Zm5.6-13h5.1c2 0 3.2-1 3.2-2.7s-1.2-2.7-3.2-2.7h-5.1v5.4Z"
        fill="white"
      />
      <circle cx="30.5" cy="9.5" r="3.5" fill="#22c55e"/>
    </svg>
  )
}

export function ReweaveIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 34V6h13.2c6 0 9.8 3.4 9.8 8.6 0 3.7-2 6.5-5.6 7.8L32.7 34h-6.8l-5.7-10.3h-4.8V34H9Zm6.4-15.6h6.1c2.5 0 4-1.4 4-3.7s-1.5-3.6-4-3.6h-6.1v7.3Z"
        fill="#1a2d4f"
      />
      <circle cx="31" cy="7.75" r="3.5" fill="#22c55e"/>
    </svg>
  )
}

// Full wordmark: Reweave in Playfair Display
export function ReweaveWordmark({ size = 24, light = false }) {
  return (
    <span
      style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: size,
        fontWeight: 800,
        fontStyle: 'normal',
        letterSpacing: '-0.5px',
        color: light ? 'rgba(255,255,255,0.9)' : '#111',
        lineHeight: 1,
      }}
    >
      Reweave
    </span>
  )
}
