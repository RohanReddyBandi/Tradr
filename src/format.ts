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

// "+4.2%" or "−1.8%"
export function formatSignedPercent(percent: number) {
  const rounded = Math.round(percent * 10) / 10
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}${Math.abs(rounded).toFixed(1)}%`
}
