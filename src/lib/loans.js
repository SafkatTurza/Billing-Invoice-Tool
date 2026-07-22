// Employee loans & advances (Phase H).
// A loan records a principal advanced to an employee and a monthly installment
// that a salary sheet deducts from net pay. Repayments are stamped with the
// sheet they came from so a re-approved sheet never double-counts.

import { todayISO } from './format.js'

export const LOAN_TYPES = ['Loan', 'Advance']

// Ways an outstanding balance can be settled / recovered. The last three are
// "non-standard" adjustments — a Note/Reason is mandatory for those so every
// balance change is explained (see methodRequiresNote).
export const SETTLEMENT_METHODS = [
  'Salary Deduction',
  'Cash',
  'Bank Transfer',
  'Mobile Banking',
  'Cheque',
  'Adjustment',
  'Write-off / Waiver',
  'Other',
]
const NOTE_REQUIRED_METHODS = ['Adjustment', 'Write-off / Waiver', 'Other']

// A note is always required for adjustments, write-offs/waivers and "Other".
export function methodRequiresNote(method) {
  return NOTE_REQUIRED_METHODS.includes(method)
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// A single audit-trail event on a loan. Every action that changes a financial
// amount or the outstanding balance appends one of these — it records who,
// what, the previous & new amounts, when and why, and is never rewritten.
export function loanHistoryEntry(action, user, extra = {}) {
  return {
    id: uid(),
    at: new Date().toISOString(),
    byId: user?.id || null,
    byName: user?.fullName || 'System',
    action,
    reason: '',
    ...extra,
  }
}

export function newLoan(emp) {
  return {
    id: 'ln-' + uid(),
    employeeId: emp?.id || '',
    empId: emp?.empId || '',
    employeeName: emp?.name || '',
    type: 'Loan',
    principal: '',
    installment: '',
    currency: emp?.currency || 'BDT',
    startDate: todayISO(),
    note: '',
    status: 'active', // active | closed
    // { id, sheetId, date, amount, method, reference, note, attachments,
    //   recordedById, recordedByName, recordedAt, updatedAt? }
    repayments: [],
    history: [], // immutable audit trail of financial changes (loanHistoryEntry)
  }
}

export function loanRepaid(loan) {
  return (loan?.repayments || []).reduce((s, r) => s + (Number(r.amount) || 0), 0)
}

export function loanOutstanding(loan) {
  return Math.max(0, Math.round(((Number(loan?.principal) || 0) - loanRepaid(loan)) * 100) / 100)
}

export function loanIsSettled(loan) {
  return loan?.status === 'closed' || loanOutstanding(loan) <= 0.005
}

// Active (still-owed) loans for an employee, most recent first.
export function activeLoansForEmployee(loans, emp) {
  if (!emp) return []
  return (loans || [])
    .filter((l) => (l.employeeId === emp.id || l.empId === emp.empId) && !loanIsSettled(l))
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
}

// The installment to deduct this month for an employee: the sum of each active
// loan's installment, each capped at that loan's outstanding balance.
export function suggestedInstallment(loans, emp) {
  const active = activeLoansForEmployee(loans, emp)
  if (!active.length) return { loanId: '', amount: 0 }
  // One line carries one loanId; pick the oldest active loan first.
  const loan = active[active.length - 1]
  const amount = Math.min(Number(loan.installment) || 0, loanOutstanding(loan))
  return { loanId: loan.id, amount: Math.round(amount * 100) / 100 }
}
