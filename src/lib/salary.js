// Salary domain — employees, salary sheets, and payslips.
// Matches the client's "Employee Remuneration Requisition" sheet and
// "Payroll Receipt Copy" payslip. Salary components are configurable as
// earnings or deductions (their "Loyalty Bonus" actually reduces net pay).

import { ls, KEYS } from './storage.js'

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Sequential employee IDs — EMP-001, never reused.
export function previewEmpId() {
  const counters = ls.get(KEYS.counters, {})
  return 'EMP-' + String((counters['EMP'] || 0) + 1).padStart(3, '0')
}
export function commitEmpId() {
  const counters = ls.get(KEYS.counters, {})
  const n = (counters['EMP'] || 0) + 1
  counters['EMP'] = n
  ls.set(KEYS.counters, counters)
  return 'EMP-' + String(n).padStart(3, '0')
}

export const EMPLOYMENT_TYPES = ['Permanent', 'Contractual', 'Foreign', 'Intern']
export const EMP_STATUSES = ['Active', 'On Leave', 'Suspended', 'Resigned', 'Terminated', 'Completed']
// Which statuses are included in a payroll run (SRS 11.2).
export const PAYROLL_STATUSES = ['Active', 'On Leave', 'Intern']

export function newEmployee() {
  return {
    id: uid(),
    empId: previewEmpId(),
    name: '',
    department: '',
    designation: '',
    employmentType: 'Permanent',
    joinDate: '',
    baseSalary: '',
    currency: 'BDT',
    paymentMethod: 'Bank Transfer',
    bank: { bankName: '', accountName: '', accountNumber: '', branch: '' },
    status: 'Active',
  }
}

// Default salary components mirroring the client's sheet. Loyalty Bonus is a
// deduction in their usage (Final = Salary − Loyalty Bonus).
export function defaultComponents() {
  return [
    { id: 'c-eid', label: 'Upcoming EID Bonus', type: 'earning' },
    { id: 'c-loyalty', label: 'Loyalty Bonus', type: 'deduction' },
    { id: 'c-lunch', label: 'Lunch', type: 'earning' },
  ]
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Standard working days used to pro-rate unpaid leave when the sheet doesn't
// specify its own. Kept as a constant so payslips and certificates agree.
export const DEFAULT_WORKING_DAYS = 26

// Full payroll breakdown for one line, given the whole sheet (needed for the
// sheet-level working-days figure that pro-rates unpaid leave). Attendance,
// overtime and loan fields are all optional — a legacy line with none of them
// reduces to the original "base + earnings − deductions" result.
export function lineComputed(line, doc) {
  const comps = (doc && doc.components) || []
  const base = Number(line.base) || 0

  const workingDays = Number(doc?.workingDays) || DEFAULT_WORKING_DAYS
  const unpaidDays = Number(line.unpaidLeave) || 0
  const perDay = workingDays > 0 ? base / workingDays : 0
  const unpaidDeduction = round2(perDay * unpaidDays)

  const overtimeAmount = round2((Number(line.overtimeHours) || 0) * (Number(line.overtimeRate) || 0))
  const loanDeduction = Number(line.loanDeduction) || 0

  let compEarnings = 0
  let compDeductions = 0
  for (const c of comps) {
    const v = Number(line.values?.[c.id]) || 0
    if (c.type === 'deduction') compDeductions += v
    else compEarnings += v
  }

  const gross = round2(base + overtimeAmount + compEarnings)
  const net = round2(gross - unpaidDeduction - compDeductions - loanDeduction)
  return { base, workingDays, unpaidDays, perDay, unpaidDeduction, overtimeAmount, loanDeduction, compEarnings, compDeductions, gross, net }
}

// Net for one salary line. Second arg is the sheet (so unpaid-leave pro-rating
// can use its working-days figure); a bare components array is still accepted
// for backward-compatible call sites.
export function lineNet(line, docOrComponents) {
  const doc = Array.isArray(docOrComponents) ? { components: docOrComponents } : docOrComponents
  return lineComputed(line, doc || {}).net
}

// Whether a sheet actually uses the Phase-H payroll fields — drives whether the
// attendance/overtime/loan columns are shown, keeping legacy sheets clean.
export function sheetUsesPayroll(doc) {
  if (!doc) return false
  if (doc.payrollMode) return true
  return (doc.lines || []).some(
    (l) => Number(l.overtimeHours) || Number(l.unpaidLeave) || Number(l.loanDeduction) || Number(l.presentDays),
  )
}

export function sheetTotals(doc) {
  const comps = doc.components || []
  const lines = doc.lines || []
  const t = { base: 0, net: 0, gross: 0, overtime: 0, unpaidDeduction: 0, loan: 0, compTotals: {} }
  for (const c of comps) t.compTotals[c.id] = 0
  for (const l of lines) {
    const c = lineComputed(l, doc)
    t.base += c.base
    t.net += c.net
    t.gross += c.gross
    t.overtime += c.overtimeAmount
    t.unpaidDeduction += c.unpaidDeduction
    t.loan += c.loanDeduction
    for (const comp of comps) t.compTotals[comp.id] += Number(l.values?.[comp.id]) || 0
  }
  t.base = round2(t.base)
  t.net = round2(t.net)
  t.gross = round2(t.gross)
  t.overtime = round2(t.overtime)
  t.unpaidDeduction = round2(t.unpaidDeduction)
  t.loan = round2(t.loan)
  return t
}

// Build a fresh salary sheet, pre-filled from active employees.
export function newSalarySheet(company, employees, previewNumber) {
  const now = new Date()
  const components = defaultComponents()
  const lines = (employees || [])
    .filter((e) => PAYROLL_STATUSES.includes(e.status))
    .map((e) => ({
      id: uid(),
      empId: e.empId,
      employeeId: e.id,
      name: e.name,
      base: e.baseSalary || '',
      currency: e.currency || 'BDT',
      values: {},
      remarks: '',
      // Attendance / overtime (Phase H) — optional; blank means full attendance.
      presentDays: '',
      unpaidLeave: '',
      overtimeHours: '',
      overtimeRate: '',
      // Loan / advance repayment deducted this month (linked to a loan record).
      loanId: '',
      loanDeduction: '',
      // payslip-only extras:
      festiveBonus: '',
      otherMisc: '',
      message: '** As per Company Policy',
      payslipRemarks: '',
      paymentDate: todayISO(),
    }))
  return {
    id: uid(),
    type: 'salary-sheet',
    companyId: company?.id || 'co-1',
    docNumber: previewNumber,
    autoNumber: true,
    date: todayISO(),
    currency: 'BDT',
    status: 'Draft',
    title: `Salary — ${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    headId: 'h-salary',
    // Phase H: standard working days for pro-rating unpaid leave; payrollMode
    // reveals the attendance/overtime/loan columns in the editor.
    workingDays: DEFAULT_WORKING_DAYS,
    payrollMode: false,
    components,
    lines,
    total: 0,
    notes: '',
    attachments: [],
    signSlots: [
      { label: 'Prepared By', signed: false },
      { label: 'Checked By', signed: false },
      { label: 'Authorised By', signed: false },
    ],
  }
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ── Year-to-date earnings (Phase H) ──────────────────────────────────────
// Does a sheet line belong to this employee? Match on either the committed
// employee id or the EMP serial so it survives renames.
export function lineIsEmployee(line, emp) {
  if (!emp) return false
  return (line.employeeId && line.employeeId === emp.id) || (line.empId && line.empId === emp.empId)
}

// Approved salary-sheet lines for one employee in a calendar year, each with
// its computed breakdown, sorted by month.
export function employeeSalaryHistory(finDocs, emp, year) {
  const rows = []
  for (const doc of finDocs || []) {
    if (doc.type !== 'salary-sheet' || doc.deleted) continue
    if (doc.status !== 'Approved') continue
    if (year && Number(doc.year) !== Number(year)) continue
    const line = (doc.lines || []).find((l) => lineIsEmployee(l, emp))
    if (!line) continue
    rows.push({ doc, line, month: Number(doc.month) || 0, computed: lineComputed(line, doc) })
  }
  return rows.sort((a, b) => a.month - b.month)
}

// Year-to-date totals for an employee: aggregate net/gross/base plus a
// per-month series suitable for a payslip "YTD" block.
export function ytdForEmployee(finDocs, emp, year) {
  const history = employeeSalaryHistory(finDocs, emp, year)
  const totals = { base: 0, gross: 0, net: 0, overtime: 0, deductions: 0, loan: 0, months: 0 }
  const series = []
  for (const { month, computed } of history) {
    totals.base = round2(totals.base + computed.base)
    totals.gross = round2(totals.gross + computed.gross)
    totals.net = round2(totals.net + computed.net)
    totals.overtime = round2(totals.overtime + computed.overtimeAmount)
    totals.deductions = round2(totals.deductions + computed.compDeductions + computed.unpaidDeduction)
    totals.loan = round2(totals.loan + computed.loanDeduction)
    totals.months += 1
    series.push({ month, label: MONTHS[month - 1] || '', net: computed.net, gross: computed.gross })
  }
  return { totals, series }
}
