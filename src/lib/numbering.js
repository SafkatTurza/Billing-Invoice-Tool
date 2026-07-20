// Document numbering — SRS section 2.
// Format: PREFIX-YYYYMMDD-SERIAL  e.g. INV-20260513-001
// Each type has its own counter that NEVER resets.

import { ls, KEYS } from './storage.js'

export const PREFIX = {
  invoices: 'INV',
  estimates: 'EST',
  'purchase-orders': 'PO',
  'work-orders': 'WO',
  'money-receipt': 'MR',
}

// Auto-receipt reference (Addendum 23.2) uses RCPT prefix.
export const RCPT_PREFIX = 'RCPT'
// Payslip reference (SRS 11.4) uses DCS-SAL.
export const SAL_PREFIX = 'DCS-SAL'

function yyyymmdd(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

// Peek current counter without incrementing.
export function peekCounter(counterKey) {
  const counters = ls.get(KEYS.counters, {})
  return counters[counterKey] || 0
}

// Increment and return the next serial for a counter key.
function nextSerial(counterKey) {
  const counters = ls.get(KEYS.counters, {})
  const next = (counters[counterKey] || 0) + 1
  counters[counterKey] = next
  ls.set(KEYS.counters, counters)
  return next
}

function format(prefix, serial, date) {
  return `${prefix}-${yyyymmdd(date)}-${String(serial).padStart(3, '0')}`
}

// Preview the number a new document WOULD get, without incrementing the
// counter. Pure — safe to call in a render/initializer. The real serial is
// reserved by commitDocNumber() at first save, so abandoned drafts never burn
// a number and StrictMode's double-invoke is harmless.
export function previewDocNumber(type, date = new Date()) {
  const prefix = PREFIX[type] || 'DOC'
  return format(prefix, peekCounter(prefix) + 1, date)
}

// Reserve and return the next serial (increments the counter). Call once, at
// the moment a new document is actually saved.
export function commitDocNumber(type, date = new Date()) {
  const prefix = PREFIX[type] || 'DOC'
  return format(prefix, nextSerial(prefix), date)
}

export function generateReceiptRef(date = new Date()) {
  const serial = nextSerial(RCPT_PREFIX)
  return `${RCPT_PREFIX}-${yyyymmdd(date)}-${String(serial).padStart(3, '0')}`
}

// Username: DCS-YYYY-0001 (Addendum 17.1). Sequential, never reused.
export function generateUsername(existingUsers = []) {
  const year = new Date().getFullYear()
  const counters = ls.get(KEYS.counters, {})
  const key = `USER-${year}`
  const next = (counters[key] || 0) + 1
  counters[key] = next
  ls.set(KEYS.counters, counters)
  return `DCS-${year}-${String(next).padStart(4, '0')}`
}
