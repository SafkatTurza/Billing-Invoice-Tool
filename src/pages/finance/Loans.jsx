import { useState } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { newLoan, LOAN_TYPES, loanRepaid, loanOutstanding, loanIsSettled } from '../../lib/loans.js'
import { CURRENCIES, formatMoney, formatDate } from '../../lib/format.js'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/finance.css'

export default function Loans() {
  const { loans, employees, saveLoan, deleteLoan } = useFinance()
  const { currentUser } = useApp()
  const toast = useToast()
  const canManage = can(currentUser.role, 'financeManage')
  const [editing, setEditing] = useState(null)
  const [showSettled, setShowSettled] = useState(false)

  const rows = loans.filter((l) => showSettled || !loanIsSettled(l))
  const startNew = () => setEditing(newLoan())
  const startEdit = (l) => setEditing(JSON.parse(JSON.stringify(l)))

  const upd = (k, v) => setEditing((e) => ({ ...e, [k]: v }))
  const onEmployee = (empId) => {
    const emp = employees.find((e) => e.id === empId)
    setEditing((e) => ({ ...e, employeeId: empId, empId: emp?.empId || '', employeeName: emp?.name || '', currency: emp?.currency || e.currency }))
  }

  const save = () => {
    if (!editing.employeeId) return toast.error('Pick an employee.')
    if (!(Number(editing.principal) > 0)) return toast.error('Principal must be greater than zero.')
    saveLoan(editing)
    toast.success('Loan saved.')
    setEditing(null)
  }

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">Loans &amp; Advances</h1>
          <p className="page-sub">Money advanced to staff, repaid via monthly salary deductions.</p>
        </div>
        <div className="row gap-8 center">
          <label className="row gap-8 center small muted" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} /> Show settled
          </label>
          {canManage && (
            <button className="btn btn-primary" onClick={startNew}>
              <Icon.plus width={16} height={16} /> New Loan / Advance
            </button>
          )}
        </div>
      </div>

      <div className="card mt-24">
        {rows.length === 0 ? (
          <div className="empty">No {showSettled ? '' : 'active '}loans or advances.</div>
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th className="text-right">Principal</th>
                <th className="text-right">Installment</th>
                <th className="text-right">Repaid</th>
                <th className="text-right">Outstanding</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="bold">{l.employeeName}<div className="mono small muted">{l.empId}</div></td>
                  <td>{l.type}</td>
                  <td className="text-right nowrap">{formatMoney(l.principal, l.currency)}</td>
                  <td className="text-right nowrap">{formatMoney(l.installment, l.currency)}</td>
                  <td className="text-right nowrap">{formatMoney(loanRepaid(l), l.currency)}</td>
                  <td className="text-right nowrap bold">{formatMoney(loanOutstanding(l), l.currency)}</td>
                  <td>
                    <span className={`badge ${loanIsSettled(l) ? 'badge-gray' : 'badge-green'}`}>{loanIsSettled(l) ? 'Settled' : 'Active'}</span>
                  </td>
                  <td className="text-right nowrap">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(l)}>
                      <Icon.edit width={14} height={14} /> {canManage ? 'Edit' : 'View'}
                    </button>
                    {canManage && (
                      <button className="btn btn-danger btn-sm" onClick={() => confirm(`Delete this ${l.type.toLowerCase()}?`) && deleteLoan(l.id)}>
                        <Icon.trash width={14} height={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {editing && (
        <Modal
          title={!canManage ? 'Loan Details' : loans.some((l) => l.id === editing.id) ? 'Edit Loan / Advance' : 'New Loan / Advance'}
          width={560}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>{canManage ? 'Cancel' : 'Close'}</button>
              {canManage && <button className="btn btn-primary" onClick={save}>Save</button>}
            </>
          }
        >
          <div className="grid grid-2">
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Employee <span className="req">*</span></label>
              <select className="select" value={editing.employeeId} disabled={!canManage} onChange={(e) => onEmployee(e.target.value)}>
                <option value="">— select —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.empId})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Type</label>
              <select className="select" value={editing.type} disabled={!canManage} onChange={(e) => upd('type', e.target.value)}>
                {LOAN_TYPES.map((t) => (<option key={t}>{t}</option>))}
              </select>
            </div>
            <div className="field">
              <label>Currency</label>
              <select className="select" value={editing.currency} disabled={!canManage} onChange={(e) => upd('currency', e.target.value)}>
                {CURRENCIES.map((c) => (<option key={c}>{c}</option>))}
              </select>
            </div>
            <div className="field">
              <label>Principal <span className="req">*</span></label>
              <input type="number" className="input" value={editing.principal} disabled={!canManage} onChange={(e) => upd('principal', e.target.value)} />
            </div>
            <div className="field">
              <label>Monthly Installment</label>
              <input type="number" className="input" value={editing.installment} disabled={!canManage} onChange={(e) => upd('installment', e.target.value)} />
            </div>
            <div className="field">
              <label>Start Date</label>
              <input type="date" className="input" value={editing.startDate} disabled={!canManage} onChange={(e) => upd('startDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Outstanding</label>
              <input className="input bold" value={formatMoney(loanOutstanding(editing), editing.currency)} disabled />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Note</label>
              <input className="input" value={editing.note} disabled={!canManage} onChange={(e) => upd('note', e.target.value)} />
            </div>
          </div>

          {(editing.repayments || []).length > 0 && (
            <>
              <div className="divider" />
              <label style={{ fontWeight: 700, color: 'var(--navy)' }}>Repayment history</label>
              <table className="table mt-8">
                <thead>
                  <tr><th>Date</th><th className="text-right">Amount</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {editing.repayments.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.date)}</td>
                      <td className="text-right nowrap">{formatMoney(r.amount, editing.currency)}</td>
                      <td className="muted small">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
