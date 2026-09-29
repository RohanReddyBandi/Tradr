// Small inline SVG icons. They use `currentColor`, so a text color class
// (like text-white) colors them.

export function LogoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <line x1="6" y1="3" x2="6" y2="19" stroke="#3ddc97" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3.5" y="7" width="5" height="8" rx="1.2" fill="#3ddc97" />
      <line x1="16" y1="3" x2="16" y2="19" stroke="#ef5b52" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="13.5" y="8" width="5" height="8" rx="1.2" fill="#ef5b52" />
    </svg>
  )
}

export function SwipeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="6.5" y="3" width="11" height="18" rx="2.5" />
      <line x1="10" y1="7" x2="14" y2="7" strokeLinecap="round" />
    </svg>
  )
}

export function LearnIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3.5" y="4.5" width="8" height="15" rx="1.5" />
      <rect x="12.5" y="4.5" width="8" height="15" rx="1.5" />
    </svg>
  )
}

export function StatsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <line x1="3.5" y1="20" x2="20.5" y2="20" />
      <line x1="6.5" y1="17" x2="6.5" y2="11" />
      <line x1="10.5" y1="17" x2="10.5" y2="5" />
      <line x1="14.5" y1="17" x2="14.5" y2="13" />
      <line x1="18.5" y1="17" x2="18.5" y2="10" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}
