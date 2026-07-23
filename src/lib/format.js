export const CURRENCIES = ['USD', 'BDT', 'EUR', 'GBP', 'AED']

const SYMBOLS = { USD: '$', BDT: '৳', EUR: '€', GBP: '£', AED: 'د.إ' }

export function currencySymbol(cur) {
  return SYMBOLS[cur] || ''
}

export function formatMoney(amount, currency = 'USD') {
  const n = Number(amount) || 0
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currencySymbol(currency)}${formatted}`
}

// Money formatted with the ISO currency code as a prefix, e.g. "BDT 200,000.00".
// Used on the Money Receipt where the code-prefixed form is the requested format.
export function formatMoneyCode(amount, currency = 'USD') {
  const n = Number(amount) || 0
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currency} ${formatted}`
}

export function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
