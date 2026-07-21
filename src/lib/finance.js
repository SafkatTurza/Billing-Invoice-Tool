// Finance domain constants, numbering, and helpers.
// Numbering mirrors the client's real refs, e.g. DCS-REQ-2606-3, PV-2606-5.

import { ls, KEYS } from './storage.js'

// Finance document types (Phase A + placeholders for later phases).
export const FIN_TYPES = {
  requisition: {
    label: 'Requisition',
    plural: 'Requisitions',
    prefix: 'REQ',
    companyPrefixed: true, // → DCS-REQ / DL-REQ
    approvable: true,
    slots: ['Proposed By', 'Checked By', 'Authorised By'], // Authorised By = management (last)
  },
  // Unified voucher (Payment or Debit chosen via doc.voucherType). This replaces
  // the two near-identical types below for all new documents; the old types are
  // kept only so previously-saved records still resolve their meta.
  voucher: {
    label: 'Voucher',
    plural: 'Vouchers',
    prefix: 'V',
    approvable: true,
    accent: '#7c3aed', // default; real accent comes from voucherAccent(doc)
    slots: ['Accountant', 'Checked By', 'Managing Director/Director', 'Received Payments'],
    // Managing Director/Director is the management/final slot (index 2)
    finalSlotIndex: 2,
  },
  // ── Legacy (pre-merge) — not offered in the UI, only rendered for old docs ──
  'payment-voucher': {
    label: 'Payment Voucher',
    plural: 'Payment Vouchers',
    prefix: 'PV',
    approvable: true,
    accent: '#7c3aed', // purple
    slots: ['Accountant', 'Checked By', 'Managing Director/Director', 'Received Payments'],
    finalSlotIndex: 2,
    legacy: true,
  },
  'debit-voucher': {
    label: 'Debit Voucher',
    plural: 'Debit Vouchers',
    prefix: 'DV',
    approvable: true,
    accent: '#d97706', // amber
    slots: ['Accountant', 'Checked By', 'Managing Director/Director', 'Received Payments'],
    finalSlotIndex: 2,
    legacy: true,
  },
  expense: {
    label: 'Daily Expense',
    plural: 'Daily Expenses',
    prefix: 'EXP',
    approvable: false, // recorded directly by Accounts; still needs a head/account
  },
  income: {
    label: 'Income / Investment',
    plural: 'Income & Investment',
    prefix: 'INC',
    approvable: false, // money IN recorded directly by Accounts (Phase C)
    accent: '#059669', // green
  },
  // Vendor bill / accounts-payable (Phase E). Recorded when money is *owed*;
  // cash only leaves the ledger when a payment is recorded against it.
  bill: {
    label: 'Bill',
    plural: 'Bills / Payables',
    prefix: 'BILL',
    approvable: false,
    accent: '#e11d48', // rose
  },
  'salary-sheet': {
    label: 'Salary Sheet',
    plural: 'Salary Sheets',
    prefix: 'SAL',
    companyPrefixed: true, // → DCS-SAL
    approvable: true,
    slots: ['Prepared By', 'Checked By', 'Authorised By'], // Authorised By = management (last)
  },
}

// For approvable docs, which slot is the management/final one. Requisition's
// last slot ("Authorised By") is management; vouchers set finalSlotIndex.
export function finalSlotIndex(type) {
  const t = FIN_TYPES[type]
  if (!t || !t.slots) return -1
  return typeof t.finalSlotIndex === 'number' ? t.finalSlotIndex : t.slots.length - 1
}

// The three types that share the voucher shape (unified + two legacy).
export function isVoucherType(type) {
  return type === 'voucher' || type === 'payment-voucher' || type === 'debit-voucher'
}
// Payment = purple, Debit = amber — driven by doc.voucherType so one type
// renders both flavours.
export function voucherAccent(doc) {
  return doc?.voucherType === 'debit' ? '#d97706' : '#7c3aed'
}
export function voucherLabel(doc) {
  return doc?.voucherType === 'debit' ? 'Debit Voucher' : 'Payment Voucher'
}
// Voucher amount — sum of the optional per-head breakdown, else the single field.
export function voucherTotal(doc) {
  const lines = doc?.lines || []
  if (lines.length) return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  return Number(doc?.amount) || 0
}

// ── Voucher receiver & money-receipt routing (Phase I) ──────────────────────
// Default: the receiver acknowledges *after* management approval (last slot).
// When the payment is made against an external money receipt, the receiver is
// recorded *before* final approval so the approver (CEO/MD) reviews the receipt
// first — the chain reorders and the final (management) slot becomes "Approved
// By".
const VOUCHER_SLOTS_DEFAULT = ['Accountant', 'Checked By', 'Managing Director/Director', 'Received Payments']
const VOUCHER_SLOTS_RECEIPT = ['Accountant', 'Checked By', 'Received Payment', 'Approved By']

export function usesMoneyReceipt(doc) {
  return isVoucherType(doc?.type) && !!doc?.moneyReceipt
}
export function voucherSlotLabels(doc) {
  return usesMoneyReceipt(doc) ? VOUCHER_SLOTS_RECEIPT : VOUCHER_SLOTS_DEFAULT
}
// Empty slots for a voucher's current receiver mode — used while it is an
// unsigned draft (never rewrites applied signatures).
export function rebuildVoucherSlots(doc) {
  return voucherSlotLabels(doc).map((label) => ({ label, signed: false }))
}
// Index of the receiver-acknowledgement slot for a voucher, else -1.
export function receivedSlotIndex(doc) {
  if (!isVoucherType(doc?.type)) return -1
  return usesMoneyReceipt(doc) ? 2 : 3
}
// Final (management) slot, receiver-mode aware. For money-receipt vouchers the
// last slot ("Approved By") is management; otherwise fall back to the type's.
export function docFinalSlotIndex(doc) {
  if (usesMoneyReceipt(doc)) return 3
  return finalSlotIndex(doc?.type)
}

function yymm(date = new Date()) {
  const y = String(date.getFullYear()).slice(-2)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}${m}`
}

function peek(counterKey) {
  const counters = ls.get(KEYS.counters, {})
  return counters[counterKey] || 0
}
function next(counterKey) {
  const counters = ls.get(KEYS.counters, {})
  const n = (counters[counterKey] || 0) + 1
  counters[counterKey] = n
  ls.set(KEYS.counters, counters)
  return n
}

// Build a finance doc number. Company-prefixed types use the company's code
// (e.g. DCS-REQ-2606-3). Vouchers/expenses use PV/DV/EXP-2606-3.
function build(type, company, serial, date) {
  const t = FIN_TYPES[type]
  const co = (company?.code || 'DCS').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const head = t.companyPrefixed ? `${co}-${t.prefix}` : t.prefix
  return `${head}-${yymm(date)}-${serial}`
}

function counterKey(type, company) {
  const t = FIN_TYPES[type]
  const co = (company?.code || 'DCS').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return t.companyPrefixed ? `${co}-${t.prefix}` : t.prefix
}

// Preview without incrementing (safe in render).
export function previewFinNumber(type, company, date = new Date()) {
  return build(type, company, peek(counterKey(type, company)) + 1, date)
}
// Commit (reserve) a serial — call once, at first save.
export function commitFinNumber(type, company, date = new Date()) {
  return build(type, company, next(counterKey(type, company)), date)
}

export const FIN_STATUS = {
  DRAFT: 'Draft',
  PENDING: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RECORDED: 'Recorded', // for non-approvable expenses
  REVERSED: 'Reversed', // approval/record undone; ledger entries voided
}

// A posted ledger row counts as a real expense/income only if it isn't an
// internal account transfer (transfers post a matched out+in pair that would
// otherwise double-count in cash-flow / P&L).
export function isExpenseTxn(t) {
  return t.status === 'posted' && t.direction === 'out' && t.linkType !== 'transfer'
}
export function isIncomeTxn(t) {
  return t.status === 'posted' && t.direction === 'in' && t.linkType !== 'transfer'
}

// ── Bills / accounts payable (Phase E) ──
// A bill's own lifecycle status stays 'Recorded'/'Reversed'; its *payment*
// status is derived purely from what's been paid against it.
export function billPaid(doc) {
  return (doc?.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
}
export function billDue(doc) {
  return Math.max(0, (Number(doc?.amount) || 0) - billPaid(doc))
}
// 'Paid' | 'Partial' | 'Open' — plus 'Reversed' if the bill itself was voided.
export function billPayStatus(doc) {
  if (doc?.status === FIN_STATUS.REVERSED) return 'Reversed'
  const paid = billPaid(doc)
  const total = Number(doc?.amount) || 0
  if (total > 0 && paid >= total - 0.005) return 'Paid'
  if (paid > 0) return 'Partial'
  return 'Open'
}
// Overdue = still owes money and the due date has passed.
export function billOverdue(doc, today = todayISO()) {
  return billDue(doc) > 0 && !!doc?.dueDate && doc.dueDate < today && doc?.status !== FIN_STATUS.REVERSED
}
// Aging bucket for an unpaid bill, by days since due date.
export function billAgeBucket(doc, today = todayISO()) {
  if (!doc?.dueDate || billDue(doc) <= 0) return null
  const days = Math.floor((new Date(today) - new Date(doc.dueDate)) / 86400000)
  if (days < 0) return 'Not due'
  if (days <= 30) return '0–30'
  if (days <= 60) return '31–60'
  if (days <= 90) return '61–90'
  return '90+'
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Build empty approval slots from a type's slot labels.
function buildSlots(type) {
  const t = FIN_TYPES[type]
  if (!t?.slots) return []
  return t.slots.map((label) => ({ label, signed: false }))
}

export function newReqItem() {
  return { id: uid(), title: '', description: '', qty: '', calcAmount: '', finalAmount: '', remarks: '' }
}

// A single line of the optional voucher expense-breakdown (split by head).
export function newVoucherLine() {
  return { id: uid(), headId: '', description: '', amount: '' }
}

// Factory for a fresh finance document.
export function newFinDoc(type, company, user) {
  const base = {
    id: uid(),
    type,
    companyId: company?.id || 'co-1',
    docNumber: previewFinNumber(type, company),
    autoNumber: true,
    date: todayISO(),
    currency: 'BDT',
    fxRate: '', // BDT per 1 unit of the doc currency; blank/1 for BDT (Phase I)
    status: FIN_STATUS.DRAFT,
    notes: '',
    attachments: [],
    signSlots: buildSlots(type),
    timeline: [], // approval-workflow event history (Phase F)
  }

  if (type === 'requisition') {
    return {
      ...base,
      title: '',
      department: user?.department || '',
      requester: user?.fullName || '',
      items: [newReqItem()],
      total: 0,
    }
  }
  if (isVoucherType(type)) {
    return {
      ...base,
      // New docs are always the unified type; the flavour is a field.
      voucherType: type === 'debit-voucher' ? 'debit' : 'payment',
      // Money-receipt / external-receiver routing (Phase I). When on, the payee
      // is outside the company: a money receipt is required and the approval
      // chain reorders so the receiver is recorded before final approval.
      moneyReceipt: false,
      receiverName: '',
      receiptNo: '',
      receivedFrom: '',
      purpose: '',
      paymentMethod: 'Cash', // Cash | Bank Transfer | Cheque | Others
      chequeNo: '',
      paymentDated: '',
      bank: '',
      branch: '',
      amount: '',
      headId: '',
      accountId: '',
      // Optional per-head breakdown; when non-empty the amount = Σ line amounts.
      lines: [],
      // Optional link to the requisition this voucher pays.
      requisitionId: '',
      requisitionNumber: '',
      // Accounts/Super Admin pick the employee this voucher relates to (optional).
      employeeId: '',
      empId: '',
      employeeName: '',
    }
  }
  if (type === 'income') {
    return {
      ...base,
      status: FIN_STATUS.RECORDED,
      kind: 'income', // 'income' | 'investment'
      headId: '',
      accountId: '',
      amount: '',
      party: '',
      description: '',
    }
  }
  if (type === 'bill') {
    return {
      ...base,
      status: FIN_STATUS.RECORDED,
      vendorName: '',
      billRef: '', // the vendor's own invoice/bill number
      dueDate: '',
      headId: '',
      amount: '',
      description: '',
      // Payments recorded against this bill; each posts a ledger 'out' entry.
      payments: [], // { id, date, amount, accountId, note, txnId }
    }
  }
  // expense
  return {
    ...base,
    status: FIN_STATUS.RECORDED,
    headId: '',
    accountId: '',
    amount: '',
    party: '',
    description: '',
  }
}

export function requisitionTotal(doc) {
  return (doc.items || []).reduce((s, it) => s + (Number(it.finalAmount) || Number(it.calcAmount) || 0), 0)
}

// ── Approval workflow (Phase F) ──────────────────────────────────────────

// Effective monetary amount of an approvable doc — used for threshold routing.
export function docAmount(doc) {
  if (!doc) return 0
  if (isVoucherType(doc.type)) return voucherTotal(doc)
  if (doc.type === 'requisition') return requisitionTotal(doc)
  return Number(doc.amount) || Number(doc.total) || 0
}

// ── Multi-currency (Phase I) ────────────────────────────────────────────────
// Finance docs are recorded in their own currency; a per-document BDT exchange
// rate converts every figure into the reporting base (BDT) used by the
// consolidated dashboards, budgets and expense-by-head totals. Native
// per-currency reports (ledger, trial balance) keep their original currency.
export const BASE_CURRENCY = 'BDT'
// The BDT rate for one unit of a doc's currency (1 for BDT, or a missing/invalid
// rate, so legacy records and blank drafts never zero out).
export function docFxRate(doc) {
  if (!doc || (doc.currency || BASE_CURRENCY) === BASE_CURRENCY) return 1
  const r = Number(doc.fxRate)
  return r > 0 ? r : 1
}
export function toBaseAmount(amount, doc) {
  return (Number(amount) || 0) * docFxRate(doc)
}
export function docBaseAmount(doc) {
  return docAmount(doc) * docFxRate(doc)
}
// A ledger transaction's BDT-base amount. Legacy rows (no baseAmount) were all
// BDT, so fall back to the raw amount.
export function txnBase(t) {
  const b = Number(t?.baseAmount)
  return b > 0 ? b : Number(t?.amount) || 0
}
// A foreign-currency doc still needs its BDT rate before it can be saved.
export function needsFxRate(doc) {
  return !!doc && (doc.currency || BASE_CURRENCY) !== BASE_CURRENCY && !(Number(doc.fxRate) > 0)
}

// Approval-rules defaults. With routing disabled (or threshold 0) the
// management/final signature is always required — the original behaviour.
export const DEFAULT_FIN_SETTINGS = { thresholdEnabled: false, threshold: 50000 }

// A doc is "high value" when routing is on and its BDT-base amount meets the
// threshold (thresholds are held in BDT, so foreign docs convert first).
export function isHighValue(doc, settings) {
  const s = settings || DEFAULT_FIN_SETTINGS
  if (!s.thresholdEnabled || !(Number(s.threshold) > 0)) return false
  return docBaseAmount(doc) >= Number(s.threshold)
}

// Whether the management (final) slot must be signed to approve this doc.
// Routing off, or a high-value doc → management required. Below threshold the
// checker (slot before management) can finalise on their own. Money-receipt
// vouchers always route to management (the approver must review the receipt).
export function requiresManagement(doc, settings) {
  if (usesMoneyReceipt(doc)) return true
  const s = settings || DEFAULT_FIN_SETTINGS
  if (!s.thresholdEnabled || !(Number(s.threshold) > 0)) return true
  return isHighValue(doc, settings)
}

// Index of the slot whose signature completes approval under the routing rules:
// the management slot when management is required, else the checker before it.
export function approvalSlotIndex(doc, settings) {
  const fi = docFinalSlotIndex(doc)
  if (fi < 0) return -1
  return requiresManagement(doc, settings) ? fi : Math.max(0, fi - 1)
}

// Human labels for timeline actions.
export const WORKFLOW_LABELS = {
  created: 'Created',
  submitted: 'Submitted for approval',
  signed: 'Signed',
  'sent-back': 'Sent back for correction',
  rejected: 'Rejected',
  approved: 'Approved',
  reversed: 'Reversed',
}

// Append an immutable event to a doc's approval timeline. Pure — returns the
// new array; callers spread it into the saved doc.
export function pushTimeline(doc, action, detail, user) {
  const entry = {
    id: uid(),
    at: new Date().toISOString(),
    byId: user?.id || null,
    byName: user?.fullName || 'Unknown',
    action,
    detail: detail || '',
  }
  return [...(doc?.timeline || []), entry]
}
