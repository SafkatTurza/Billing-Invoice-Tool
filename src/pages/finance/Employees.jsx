import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { newEmployee, commitEmpId, EMPLOYMENT_TYPES, EMP_STATUSES } from '../../lib/salary.js'
import { CURRENCIES, formatMoney } from '../../lib/format.js'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'

const STATUS_BADGE = {
  Active: 'badge-green',
  'On Leave': 'badge-amber',
  Suspended: 'badge-red',
  Resigned: 'badge-gray',
  Terminated: 'badge-gray',
  Completed: 'badge-gray',
}

export default function Employees() {
  const { employees, saveEmployee, deleteEmployee } = useFinance()
  const { currentUser } = useApp()
  const navigate = useNavigate()
  const toast = useToast()
  const canManage = can(currentUser.role, 'financeManage')
  const [editing, setEditing] = useState(null)

  const startNew = () => setEditing(newEmployee())
  const startEdit = (e) => setEditing(JSON.parse(JSON.stringify(e)))

  const save = () => {
    if (!editing.name.trim()) return toast.error('Employee name is required.')
    let emp = editing
    // Commit the EMP id on first save (reserve the serial).
    if (!employees.some((e) => e.id === editing.id)) {
      emp = { ...editing, empId: commitEmpId() }
    }
    saveEmployee(emp)
    toast.success('Employee saved.')
    setEditing(null)
  }

  const upd = (k, v) => setEditing((e) => ({ ...e, [k]: v }))
  const updBank = (k, v) => setEditing((e) => ({ ...e, bank: { ...e.bank, [k]: v } }))

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-sub">Staff records used to pre-fill salary sheets and payslips.</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={startNew}>
            <Icon.plus width={16} height={16} /> Add Employee
          </button>
        )}
      </div>

      <div className="card mt-24">
        {employees.length === 0 ? (
          <div className="empty">No employees yet.</div>
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th className="text-right">Base Salary</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="mono small">{e.empId}</td>
                  <td className="bold">{e.name}</td>
                  <td className="muted">{e.department || '—'}</td>
                  <td className="muted">{e.designation || '—'}</td>
                  <td className="text-right nowrap">{formatMoney(e.baseSalary, e.currency)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[e.status] || 'badge-gray'}`}>{e.status}</span>
                  </td>
                  <td className="text-right nowrap">
                    <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/finance/employees/${e.id}/certificate`)} title="Salary Certificate">
                        <Icon.receipt width={14} height={14} /> Certificate
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(e)}>
                        <Icon.edit width={14} height={14} /> {canManage ? 'Edit' : 'View'}
                      </button>
                      {canManage && (
                        <button className="btn btn-danger btn-sm" onClick={() => confirm(`Remove ${e.name}?`) && deleteEmployee(e.id)}>
                          <Icon.trash width={14} height={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {editing && (
        <Modal
          title={!canManage ? 'Employee Details' : employees.some((e) => e.id === editing.id) ? 'Edit Employee' : 'Add Employee'}
          width={640}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                {canManage ? 'Cancel' : 'Close'}
              </button>
              {canManage && (
                <button className="btn btn-primary" onClick={save}>
                  Save Employee
                </button>
              )}
            </>
          }
        >
          <div className="grid grid-2">
            <div className="field">
              <label>
                Full Name <span className="req">*</span>
              </label>
              <input className="input" autoFocus value={editing.name} onChange={(e) => upd('name', e.target.value)} />
            </div>
            <div className="field">
              <label>Employee ID</label>
              <input className="input mono" value={editing.empId} disabled />
            </div>
            <div className="field">
              <label>Department</label>
              <input className="input" value={editing.department} onChange={(e) => upd('department', e.target.value)} />
            </div>
            <div className="field">
              <label>Designation</label>
              <input className="input" value={editing.designation} onChange={(e) => upd('designation', e.target.value)} />
            </div>
            <div className="field">
              <label>Employment Type</label>
              <select className="select" value={editing.employmentType} onChange={(e) => upd('employmentType', e.target.value)}>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Join Date</label>
              <input type="date" className="input" value={editing.joinDate} onChange={(e) => upd('joinDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Base Monthly Salary</label>
              <input type="number" className="input" value={editing.baseSalary} onChange={(e) => upd('baseSalary', e.target.value)} />
            </div>
            <div className="field">
              <label>Currency</label>
              <select className="select" value={editing.currency} onChange={(e) => upd('currency', e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Payment Method</label>
              <select className="select" value={editing.paymentMethod} onChange={(e) => upd('paymentMethod', e.target.value)}>
                {['Bank Transfer', 'Wire Transfer', 'Cash'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select className="select" value={editing.status} onChange={(e) => upd('status', e.target.value)}>
                {EMP_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="divider" />
          <label style={{ fontWeight: 700, color: 'var(--navy)' }}>Bank Details (profile only — never on payslip)</label>
          <div className="grid grid-2 mt-8">
            <div className="field">
              <label>Bank Name</label>
              <input className="input" value={editing.bank.bankName} onChange={(e) => updBank('bankName', e.target.value)} />
            </div>
            <div className="field">
              <label>Account Name</label>
              <input className="input" value={editing.bank.accountName} onChange={(e) => updBank('accountName', e.target.value)} />
            </div>
            <div className="field">
              <label>Account Number</label>
              <input className="input" value={editing.bank.accountNumber} onChange={(e) => updBank('accountNumber', e.target.value)} />
            </div>
            <div className="field">
              <label>Branch</label>
              <input className="input" value={editing.bank.branch} onChange={(e) => updBank('branch', e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
