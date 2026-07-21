import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { previewFinNumber } from '../../lib/finance.js'
import { newSalarySheet, lineNet, lineComputed, sheetTotals, MONTHS } from '../../lib/salary.js'
import { activeLoansForEmployee, suggestedInstallment, loanOutstanding } from '../../lib/loans.js'
import { CURRENCIES, formatMoney } from '../../lib/format.js'
import { uid } from '../../lib/format.js'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/documents.css'

export default function SalarySheetEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { finDocs, saveFinDoc, employees, loans } = useFinance()
  const { company, currentUser } = useApp()
  const toast = useToast()

  const existing = id ? finDocs.find((d) => d.id === id) : null
  const [doc, setDoc] = useState(
    () => existing || newSalarySheet(company, employees, previewFinNumber('salary-sheet', company)),
  )
  const patch = (c) => setDoc((p) => ({ ...p, ...c }))
  const totals = sheetTotals(doc)

  const updLine = (lineId, changes) => patch({ lines: doc.lines.map((l) => (l.id === lineId ? { ...l, ...changes } : l)) })
  const updLineValue = (lineId, compId, v) =>
    patch({ lines: doc.lines.map((l) => (l.id === lineId ? { ...l, values: { ...l.values, [compId]: v } } : l)) })
  const removeLine = (lineId) => patch({ lines: doc.lines.filter((l) => l.id !== lineId) })

  // Resolve the employee record behind a line (for loan lookups).
  const empForLine = (l) => employees.find((e) => e.id === l.employeeId || e.empId === l.empId)

  // Pull each employee's suggested loan installment (capped at outstanding)
  // into that line's loan deduction, in one click.
  const autofillLoans = () => {
    let filled = 0
    patch({
      lines: doc.lines.map((l) => {
        const s = suggestedInstallment(loans, empForLine(l))
        if (!s.loanId || s.amount <= 0) return l
        filled++
        return { ...l, loanId: s.loanId, loanDeduction: s.amount }
      }),
    })
    toast[filled ? 'success' : 'error'](filled ? `Loan installment set on ${filled} line(s).` : 'No active loans for these employees.')
  }

  const addComponent = () =>
    patch({ components: [...doc.components, { id: 'c-' + uid(), label: 'New Component', type: 'earning' }] })
  const updComponent = (cid, changes) => patch({ components: doc.components.map((c) => (c.id === cid ? { ...c, ...changes } : c)) })
  const removeComponent = (cid) =>
    patch({
      components: doc.components.filter((c) => c.id !== cid),
      lines: doc.lines.map((l) => {
        const { [cid]: _, ...rest } = l.values || {}
        return { ...l, values: rest }
      }),
    })

  const save = () => {
    if (doc.lines.length === 0) return toast.error('Add at least one employee line.')
    const status = doc.status === 'Draft' ? 'Pending Approval' : doc.status
    const saved = saveFinDoc({ ...doc, total: totals.net, status })
    toast.success('Salary sheet saved — routed for approval.')
    navigate(`/finance/salary-sheet/${saved.id}`)
  }

  return (
    <div>
      <div className="editor-head">
        <div>
          <h1 className="page-title">{existing ? 'Edit' : 'New'} Salary Sheet</h1>
          <p className="page-sub mono">{doc.docNumber}</p>
        </div>
        <div className="row gap-8 center">
          <button className="btn btn-ghost" onClick={() => navigate('/finance/salary-sheet')}>
            Back
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Icon.check width={16} height={16} /> Save & Submit
          </button>
        </div>
      </div>

      <div className="form-section">
        <h3>Sheet Information</h3>
        <div className="grid grid-4">
          <div className="field">
            <label>Number</label>
            <input className="input mono" value={doc.docNumber} onChange={(e) => patch({ docNumber: e.target.value, autoNumber: false })} />
          </div>
          <div className="field">
            <label>Month</label>
            <select className="select" value={doc.month} onChange={(e) => patch({ month: Number(e.target.value), title: `Salary — ${MONTHS[e.target.value - 1]} ${doc.year}` })}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Year</label>
            <input type="number" className="input" value={doc.year} onChange={(e) => patch({ year: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Currency</label>
            <select className="select" value={doc.currency} onChange={(e) => patch({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Working Days</label>
            <input type="number" className="input" value={doc.workingDays ?? ''} onChange={(e) => patch({ workingDays: e.target.value })} />
          </div>
        </div>
        <label className="row gap-8 center mt-16" style={{ cursor: 'pointer', fontWeight: 600 }}>
          <input type="checkbox" checked={!!doc.payrollMode} onChange={(e) => patch({ payrollMode: e.target.checked })} />
          Track attendance, overtime &amp; loan deductions
        </label>
        <p className="small muted" style={{ marginTop: 4 }}>
          Unpaid-leave days are pro-rated on the base salary using Working Days; overtime is hours × rate; loan installments repay employee loans on approval.
        </p>
      </div>

      {/* Components config */}
      <div className="form-section">
        <h3>
          Salary Components
          <button className="btn btn-ghost btn-sm" onClick={addComponent}>
            <Icon.plus width={14} height={14} /> Add Component
          </button>
        </h3>
        <p className="small muted mb-16">
          Each component is an <b>earning</b> (adds to net) or <b>deduction</b> (subtracts). e.g. Loyalty
          Bonus is typically a deduction.
        </p>
        <div className="grid grid-3">
          {doc.components.map((c) => (
            <div key={c.id} className="row gap-8 center" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              <input className="input" style={{ flex: 1 }} value={c.label} onChange={(e) => updComponent(c.id, { label: e.target.value })} />
              <select className="select" style={{ width: 120 }} value={c.type} onChange={(e) => updComponent(c.id, { type: e.target.value })}>
                <option value="earning">Earning +</option>
                <option value="deduction">Deduction −</option>
              </select>
              <button className="btn btn-danger btn-sm" onClick={() => removeComponent(c.id)}>
                <Icon.x width={13} height={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lines */}
      <div className="form-section">
        <h3>
          Employees ({doc.lines.length})
          {employees.length === 0 && <span className="small muted" style={{ fontWeight: 400 }}>Add employees in Finance → Employees first</span>}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>SL</th>
                <th style={{ minWidth: 150 }}>Name</th>
                <th style={{ width: 110 }}>Salary</th>
                {doc.components.map((c) => (
                  <th key={c.id} style={{ width: 100 }}>
                    {c.label} {c.type === 'deduction' ? '−' : '+'}
                  </th>
                ))}
                <th style={{ width: 110 }}>Final Amount</th>
                <th style={{ minWidth: 120 }}>Remarks</th>
                <th style={{ width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={l.id}>
                  <td style={{ textAlign: 'center', color: 'var(--text-faint)' }}>{i + 1}</td>
                  <td>
                    <input value={l.name} onChange={(e) => updLine(l.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" value={l.base} onChange={(e) => updLine(l.id, { base: e.target.value })} />
                  </td>
                  {doc.components.map((c) => (
                    <td key={c.id}>
                      <input type="number" value={l.values?.[c.id] || ''} onChange={(e) => updLineValue(l.id, c.id, e.target.value)} />
                    </td>
                  ))}
                  <td>
                    <input disabled value={lineNet(l, doc).toLocaleString('en-US', { minimumFractionDigits: 2 })} style={{ fontWeight: 700 }} />
                  </td>
                  <td>
                    <input value={l.remarks} onChange={(e) => updLine(l.id, { remarks: e.target.value })} />
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm" style={{ padding: '5px 8px' }} onClick={() => removeLine(l.id)}>
                      <Icon.x width={13} height={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, padding: '8px' }}>
                  Total Remuneration
                </td>
                <td style={{ fontWeight: 700, padding: '8px' }}>{totals.base.toLocaleString()}</td>
                {doc.components.map((c) => (
                  <td key={c.id} style={{ fontWeight: 700, padding: '8px' }}>
                    {(totals.compTotals[c.id] || 0).toLocaleString()}
                  </td>
                ))}
                <td style={{ fontWeight: 800, padding: '8px', color: 'var(--navy)' }}>{totals.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Attendance, overtime & loan deductions (Phase H) */}
      {doc.payrollMode && (
        <div className="form-section">
          <h3>
            Attendance, Overtime &amp; Loans
            <button className="btn btn-ghost btn-sm" onClick={autofillLoans}>
              <Icon.download width={14} height={14} /> Auto-fill loan installments
            </button>
          </h3>
          <p className="small muted mb-16">
            Working days this month: <b>{doc.workingDays || '—'}</b>. Leave a field blank for none. Overtime and loan repayments flow straight into each employee's Final Amount.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="items-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>SL</th>
                  <th style={{ minWidth: 140 }}>Name</th>
                  <th style={{ width: 90 }}>Present</th>
                  <th style={{ width: 100 }}>Unpaid Leave</th>
                  <th style={{ width: 90 }}>OT Hrs</th>
                  <th style={{ width: 90 }}>OT Rate</th>
                  <th style={{ width: 100 }}>OT Amount</th>
                  <th style={{ minWidth: 150 }}>Loan / Advance</th>
                  <th style={{ width: 110 }}>Installment</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => {
                  const c = lineComputed(l, doc)
                  const empLoans = activeLoansForEmployee(loans, empForLine(l))
                  return (
                    <tr key={l.id}>
                      <td style={{ textAlign: 'center', color: 'var(--text-faint)' }}>{i + 1}</td>
                      <td>{l.name}</td>
                      <td>
                        <input type="number" value={l.presentDays ?? ''} onChange={(e) => updLine(l.id, { presentDays: e.target.value })} />
                      </td>
                      <td>
                        <input type="number" value={l.unpaidLeave ?? ''} onChange={(e) => updLine(l.id, { unpaidLeave: e.target.value })} />
                      </td>
                      <td>
                        <input type="number" value={l.overtimeHours ?? ''} onChange={(e) => updLine(l.id, { overtimeHours: e.target.value })} />
                      </td>
                      <td>
                        <input type="number" value={l.overtimeRate ?? ''} onChange={(e) => updLine(l.id, { overtimeRate: e.target.value })} />
                      </td>
                      <td>
                        <input disabled value={c.overtimeAmount ? c.overtimeAmount.toLocaleString() : ''} style={{ color: 'var(--green)', fontWeight: 700 }} />
                      </td>
                      <td>
                        <select value={l.loanId || ''} onChange={(e) => updLine(l.id, { loanId: e.target.value })}>
                          <option value="">— none —</option>
                          {empLoans.map((ln) => (
                            <option key={ln.id} value={ln.id}>
                              {ln.type} · {formatMoney(loanOutstanding(ln), ln.currency)} left
                            </option>
                          ))}
                          {/* keep a previously-chosen but now-settled loan selectable */}
                          {l.loanId && !empLoans.some((ln) => ln.id === l.loanId) && <option value={l.loanId}>selected loan</option>}
                        </select>
                      </td>
                      <td>
                        <input type="number" value={l.loanDeduction ?? ''} onChange={(e) => updLine(l.id, { loanDeduction: e.target.value })} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, padding: '8px' }}>
                    Totals
                  </td>
                  <td style={{ fontWeight: 700, padding: '8px', color: 'var(--green)' }}>{totals.overtime.toLocaleString()}</td>
                  <td></td>
                  <td style={{ fontWeight: 700, padding: '8px', color: 'var(--red)' }}>{totals.loan.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="row gap-12 mt-16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/finance/salary-sheet')}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save}>
          <Icon.check width={16} height={16} /> Save & Submit for Approval
        </button>
      </div>
    </div>
  )
}
