import { useState, useMemo } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { CURRENCIES, formatMoney } from '../../lib/format.js'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'

// Phase E — Recurring entries. Templates that spawn a Daily Expense or a Bill
// once a month (rent, internet, subscriptions…). Nothing posts automatically;
// when an entry is due it shows a "Post now" button so a person stays in the
// loop. dayOfMonth is capped at 28 so every month has that day.
const KINDS = [
  { value: 'expense', label: 'Daily Expense (posts to ledger)' },
  { value: 'bill', label: 'Bill / Payable (recorded as owed)' },
]

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function Recurring() {
  const { heads, accounts, recurring, saveRecurring, deleteRecurring, runRecurring } = useFinance()
  const { company, currentUser } = useApp()
  const toast = useToast()
  const canManage = can(currentUser.role, 'financeManage')
  const expenseHeads = heads.filter((h) => h.kind === 'expense')

  const [form, setForm] = useState(null)
  const thisMonth = new Date().toISOString().slice(0, 7)

  const headName = (id) => heads.find((h) => h.id === id)?.name || '—'
  const accName = (id) => accounts.find((a) => a.id === id)?.name || '—'

  const rows = useMemo(() => [...recurring].sort((a, b) => (a.name || '').localeCompare(b.name || '')), [recurring])

  // "Due" = active, and not yet generated for the current month.
  const isDue = (r) => r.active !== false && r.lastRunMonth !== thisMonth

  const startNew = () =>
    setForm({
      id: '',
      kind: 'expense',
      name: '',
      vendorName: '',
      headId: expenseHeads[0]?.id || '',
      accountId: accounts[0]?.id || '',
      amount: '',
      currency: 'BDT',
      description: '',
      dayOfMonth: 1,
      active: true,
      lastRunMonth: '',
    })

  const startEdit = (r) => setForm({ ...r })

  const save = () => {
    if (!form.name?.trim()) return toast.error('Give the recurring entry a name.')
    if (!(Number(form.amount) > 0)) return toast.error('Enter an amount.')
    saveRecurring({ ...form, dayOfMonth: Math.min(28, Math.max(1, Number(form.dayOfMonth) || 1)) })
    toast.success('Recurring entry saved.')
    setForm(null)
  }

  const post = (r) => {
    const created = runRecurring(r.id)
    if (created) toast.success(`Generated ${created.docNumber}.`)
    else toast.info('Already generated for this month.')
  }

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const isBill = form?.kind === 'bill'

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">Recurring Entries</h1>
          <p className="page-sub">Monthly rent, internet, subscriptions… Generate each month with one click — nothing posts on its own.</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={startNew}>
            <Icon.plus width={16} height={16} /> New Recurring
          </button>
        )}
      </div>

      <div className="card mt-24">
        {rows.length === 0 ? (
          <div className="empty">No recurring entries yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Head</th>
                <th>Every</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const due = isDue(r)
                const inactive = r.active === false
                return (
                  <tr key={r.id} style={inactive ? { opacity: 0.55 } : undefined}>
                    <td className="bold">
                      {r.name}
                      {r.vendorName ? <div className="small muted">{r.vendorName}</div> : null}
                    </td>
                    <td>
                      <span className={`badge ${r.kind === 'bill' ? 'badge-red' : 'badge-blue'}`}>{r.kind === 'bill' ? 'Bill' : 'Expense'}</span>
                    </td>
                    <td className="small">{headName(r.headId)}{r.kind === 'expense' && r.accountId ? ` · ${accName(r.accountId)}` : ''}</td>
                    <td className="small nowrap">{ordinal(Math.min(28, Math.max(1, Number(r.dayOfMonth) || 1)))}</td>
                    <td className="text-right nowrap">{formatMoney(r.amount, r.currency)}</td>
                    <td>
                      {inactive ? (
                        <span className="badge badge-gray">Paused</span>
                      ) : due ? (
                        <span className="badge badge-amber">Due this month</span>
                      ) : (
                        <span className="badge badge-green">Done for {thisMonth}</span>
                      )}
                    </td>
                    <td className="text-right nowrap">
                      {canManage && (
                        <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                          {due && (
                            <button className="btn btn-primary btn-sm" onClick={() => post(r)} title="Generate this month">
                              Post now
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)} title="Edit">
                            <Icon.edit width={14} height={14} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--red)' }}
                            onClick={() => {
                              if (confirm(`Delete recurring entry "${r.name}"?`)) {
                                deleteRecurring(r.id)
                                toast.success('Deleted.')
                              }
                            }}
                            title="Delete"
                          >
                            <Icon.trash width={14} height={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal
          title={form.id ? 'Edit Recurring Entry' : 'New Recurring Entry'}
          width={580}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                <Icon.check width={16} height={16} /> Save
              </button>
            </>
          }
        >
          <div className="grid grid-2">
            <div className="field">
              <label>
                Name <span className="req">*</span>
              </label>
              <input className="input" autoFocus value={form.name} onChange={(e) => upd('name', e.target.value)} placeholder="e.g. Office rent" />
            </div>
            <div className="field">
              <label>Type</label>
              <select className="select" value={form.kind} onChange={(e) => upd('kind', e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{isBill ? 'Vendor' : 'Payee (optional)'}</label>
              <input className="input" value={form.vendorName} onChange={(e) => upd('vendorName', e.target.value)} />
            </div>
            <div className="field">
              <label>Expense Head</label>
              <select className="select" value={form.headId} onChange={(e) => upd('headId', e.target.value)}>
                {expenseHeads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            {!isBill && (
              <div className="field">
                <label>Paid From</label>
                <select className="select" value={form.accountId} onChange={(e) => upd('accountId', e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>
                Amount <span className="req">*</span>
              </label>
              <input type="number" className="input" value={form.amount} onChange={(e) => upd('amount', e.target.value)} />
            </div>
            <div className="field">
              <label>Currency</label>
              <select className="select" value={form.currency} onChange={(e) => upd('currency', e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Day of Month</label>
              <input
                type="number"
                min="1"
                max="28"
                className="input"
                value={form.dayOfMonth}
                onChange={(e) => upd('dayOfMonth', e.target.value)}
              />
            </div>
            <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label className="row gap-8 center" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active !== false} onChange={(e) => upd('active', e.target.checked)} />
                Active
              </label>
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Description</label>
              <input className="input" value={form.description} onChange={(e) => upd('description', e.target.value)} placeholder="appears on the generated entry" />
            </div>
          </div>
          <p className="small muted">
            When due, this generates a {isBill ? 'bill due' : 'daily expense dated'} on the {ordinal(Math.min(28, Math.max(1, Number(form.dayOfMonth) || 1)))}.
            You post it yourself each month.
          </p>
        </Modal>
      )}
    </div>
  )
}
