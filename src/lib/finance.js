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
  'payment-voucher': {
    label: 'Payment Voucher',
    plural: 'Payment Vouchers',
    prefix: 'PV',
    approvable: true,
    accent: '#7c3aed', // purple
    slots: ['Accountant', 'Checked By', 'Managing Director/Director', 'Received Payments'],
    // Managing Director/Director is the management/final slot (index 2)
    finalSlotIndex: 2,
  },
  'debit-voucher': {
    label: 'Debit Voucher',
    plural: 'Debit Vouchers',
    prefix: 'DV',
    approvable: true,
    accent: '#d97706', // amber
    slots: ['Accountant', 'Checked By', 'Managing Director/Director', 'Received Payments'],
    finalSlotIndex: 2,
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
    status: FIN_STATUS.DRAFT,
    notes: '',
    attachments: [],
    signSlots: buildSlots(type),
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
  if (type === 'payment-voucher' || type === 'debit-voucher') {
    return {
      ...base,
      voucherType: type === 'payment-voucher' ? 'payment' : 'debit',
      receivedFrom: '',
      purpose: '',
      paymentMethod: 'Cash',
      paymentDated: '',
      bank: '',
      branch: '',
      amount: '',
      headId: '',
      accountId: '',
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
