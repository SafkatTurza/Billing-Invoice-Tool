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

// Net for one salary line: base + Σ earnings − Σ deductions.
export function lineNet(line, components) {
  const base = Number(line.base) || 0
  let net = base
  for (const c of components) {
    const v = Number(line.values?.[c.id]) || 0
    net += c.type === 'deduction' ? -v : v
  }
  return net
}

export function sheetTotals(doc) {
  const comps = doc.components || []
  const lines = doc.lines || []
  const base = lines.reduce((s, l) => s + (Number(l.base) || 0), 0)
  const net = lines.reduce((s, l) => s + lineNet(l, comps), 0)
  const compTotals = {}
  for (const c of comps) compTotals[c.id] = lines.reduce((s, l) => s + (Number(l.values?.[c.id]) || 0), 0)
  return { base, net, compTotals }
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
