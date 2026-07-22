import { useState, useMemo } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { newFinDoc } from '../../lib/finance.js'
import { can } from '../../lib/roles.js'
import { CURRENCIES, formatMoney, formatDate, todayISO } from '../../lib/format.js'
import { FIN_STATUS } from '../../lib/finance.js'
import AttachmentField from '../../components/AttachmentField.jsx'
import Modal from '../../components/Modal.jsx'
import ReverseModal from '../../components/finance/ReverseModal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'

// Quick daily-expense entry. Recorded straight to the ledger (no approval
// chain — these are small operational cash spends). Still classified by head
// and account so reports stay complete.
export default function DailyExpenses() {
  const { finDocs, heads, accounts, recordExpense, reverseFinDoc } = useFinance()
  const { company, currentUser } = useApp()
  const toast = useToast()
  const canManage = can(currentUser.role, 'financeManage')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [reverseDoc, setReverseDoc] = useState(null)

  const expenseHeads = heads.filter((h) => h.kind === 'expense')
  const rows = useMemo(
    () => finDocs.filter((d) => d.type === 'expense' && !d.deleted).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [finDocs],
  )

  const startNew = () => {
    setForm({
      ...newFinDoc('expense', company, currentUser),
      date: todayISO(),
      headId: expenseHeads[0]?.id || '',
      accountId: accounts[0]?.id || '',
    })
    setOpen(true)
  }

  const save = () => {
    if (!form.description?.trim()) return toast.error('Description is required.')
    if (!(Number(form.amount) > 0)) return toast.error('Enter an amount.')
    recordExpense(form)
    toast.success('Expense recorded.')
    setOpen(false)
  }

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const headName = (id) => heads.find((h) => h.id === id)?.name || '—'
  const accName = (id) => accounts.find((a) => a.id === id)?.name || '—'

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">Daily Expenses</h1>
          <p className="page-sub">Quick cash spends — recorded straight to the ledger.</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={startNew}>
            <Icon.plus width={16} height={16} /> Record Expense
          </button>
        )}
      </div>

      <div className="card mt-24">
        {rows.length === 0 ? (
          <div className="empty">No daily expenses recorded yet.</div>
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Description</th>
                <th>Head</th>
                <th>Account</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const reversed = d.status === FIN_STATUS.REVERSED
                return (
                <tr key={d.id} style={reversed ? { opacity: 0.55 } : undefined}>
                  <td className="mono small">{d.docNumber}</td>
                  <td className="small nowrap">{formatDate(d.date)}</td>
                  <td>
                    {d.description}
                    {reversed && <span className="badge badge-gray" style={{ marginLeft: 8 }}>Reversed</span>}
                  </td>
                  <td className="small">{headName(d.headId)}</td>
                  <td className="small">{accName(d.accountId)}</td>
                  <td className="text-right nowrap ledger-out">{formatMoney(d.amount, d.currency)}</td>
                  <td className="text-right nowrap">
                    {canManage && !reversed && (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setReverseDoc(d)} title="Reverse">
                        <Icon.x width={14} height={14} />
                      </button>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {open && form && (
        <Modal
          title="Record Daily Expense"
          width={560}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                <Icon.check width={16} height={16} /> Record
              </button>
            </>
          }
        >
          <div className="field">
            <label>
              Description <span className="req">*</span>
            </label>
            <input className="input" autoFocus value={form.description} onChange={(e) => upd('description', e.target.value)} placeholder="e.g. Office tea & snacks" />
          </div>
          <div className="grid grid-3">
            <div className="field">
              <label>Date</label>
              <input type="date" className="input" value={form.date} onChange={(e) => upd('date', e.target.value)} />
            </div>
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
              <label>Expense Head</label>
              <select className="select" value={form.headId} onChange={(e) => upd('headId', e.target.value)}>
                {expenseHeads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="field">
              <label>Payee (optional)</label>
              <input className="input" value={form.party} onChange={(e) => upd('party', e.target.value)} />
            </div>
          </div>
          <AttachmentField label="Attach receipt (optional)" value={form.attachments} onChange={(a) => upd('attachments', a)} />
        </Modal>
      )}

      {reverseDoc && (
        <ReverseModal
          label={`expense ${reverseDoc.docNumber}`}
          onCancel={() => setReverseDoc(null)}
          onConfirm={(reason) => {
            reverseFinDoc(reverseDoc.id, reason)
            setReverseDoc(null)
            toast.success('Expense reversed.')
          }}
        />
      )}
    </div>
  )
}
