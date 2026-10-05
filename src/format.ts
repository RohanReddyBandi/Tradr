// Number formatting shared across the app.

export function formatMoney(amount: number) {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// "+$42.10" or "−$60.49" (a real minus sign, so the digits line up).
export function formatSignedMoney(amount: number) {
  const rounded = Math.round(amount * 100) / 100
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}${formatMoney(Math.abs(rounded))}`
}

// "+2.0R" or "−1.0R": a result measured in multiples of what you risked.
export function formatR(r: number) {
  const rounded = Math.round(r * 10) / 10
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}${Math.abs(rounded).toFixed(1)}R`
}

// "+4.2%" or "−1.8%"
export function formatSignedPercent(percent: number) {
  const rounded = Math.round(percent * 10) / 10
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}${Math.abs(rounded).toFixed(1)}%`
}

// "Mar 1 – Jun 30, 2023", or "Dec 2, 2022 – Feb 1, 2023" across a new year.
export function dateRange(from: string, to: string) {
  const f = new Date(`${from}T00:00:00Z`)
  const t = new Date(`${to}T00:00:00Z`)
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' } as const
  const sameYear = f.getUTCFullYear() === t.getUTCFullYear()
  const start = f.toLocaleDateString('en-US', sameYear ? opts : { ...opts, year: 'numeric' })
  return `${start} – ${t.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}
