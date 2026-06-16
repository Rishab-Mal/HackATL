// Shared fibr logo components — matches the fibr brand kit

// Badge icon (dark navy square + white F + green dot) — works on any background
export function FibrBadge({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#1a2d4f"/>
      <rect x="9" y="8.5" width="5.5" height="23" rx="1.5" fill="white"/>
      <rect x="9" y="8.5" width="19" height="5.5" rx="1.5" fill="white"/>
      <rect x="9" y="18.5" width="13.5" height="4.5" rx="1.5" fill="white"/>
      <circle cx="29.5" cy="11.5" r="3.5" fill="#22c55e"/>
    </svg>
  )
}

// Icon-only F mark (dark teal on transparent) — for lockup with wordmark
export function FibrIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7" y="6" width="5.5" height="28" rx="1.5" fill="#1a2d4f"/>
      <rect x="7" y="6" width="20" height="5.5" rx="1.5" fill="#1a2d4f"/>
      <rect x="7" y="19" width="14" height="4.5" rx="1.5" fill="#1a2d4f"/>
      <circle cx="28.5" cy="8.75" r="3.5" fill="#22c55e"/>
    </svg>
  )
}

// Full wordmark: fibr in Playfair Display
export function FibrWordmark({ size = 24, light = false }) {
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
      fibr
    </span>
  )
}
