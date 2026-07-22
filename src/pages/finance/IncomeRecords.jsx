import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { newFinDoc, FIN_STATUS, needsFxRate } from '../../lib/finance.js'
import { can } from '../../lib/roles.js'
import { CURRENCIES, formatMoney, formatDate, todayISO } from '../../lib/format.js'
import AttachmentField from '../../components/AttachmentField.jsx'
import FxRateField from '../../components/finance/FxRateField.jsx'
import Modal from '../../components/Modal.jsx'
import ReverseModal from '../../components/finance/ReverseModal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'

// Phase C — Income & Investment records. Money IN (service income, capital /
// investment injections) recorded straight to the ledger so the reports pack
// (cash flow, P&L) sees the full picture, not just expenses. Recording is
// reserved for Accounts + Super Admin; others get a read-only list.
export default function IncomeRecords() {
  const { finDocs, heads, accounts, recordIncome, reverseFinDoc } = useFinance()
  const { company, currentUser } = useApp()
  const navigate = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [reverseDoc, setReverseDoc] = useState(null)

  const canManage = can(currentUser.role, 'financeManage')
  const incomeHeads = heads.filter((h) => h.kind === 'income')
  const investHeads = heads.filter((h) => h.kind === 'investment')

  const rows = useMemo(
    () => finDocs.filter((d) => d.type === 'income' && !d.deleted).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [finDocs],
  )

  const startNew = (kind) => {
    const pool = kind === 'investment' ? investHeads : incomeHeads
    setForm({
      ...newFinDoc('income', company, currentUser),
      kind,
      date: todayISO(),
      headId: pool[0]?.id || '',
      accountId: accounts[0]?.id || '',
    })
    setOpen(true)
  }

  const save = () => {
    if (!form.description?.trim()) return toast.error('Description is required.')
    if (!(Number(form.amount) > 0)) return toast.error('Enter an amount.')
    if (needsFxRate(form)) return toast.error(`Enter the ${form.currency} → BDT exchange rate.`)
    recordIncome(form)
    toast.success(`${form.kind === 'investment' ? 'Investment' : 'Income'} recorded.`)
    setOpen(false)
  }

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const headName = (id) => heads.find((h) => h.id === id)?.name || '—'
  const accName = (id) => accounts.find((a) => a.id === id)?.name || '—'
  const formHeads = form?.kind === 'investment' ? investHeads : incomeHeads

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">Income &amp; Investment</h1>
          <p className="page-sub">Money received — service income and investment / capital — recorded straight to the ledger.</p>
        </div>
        {canManage && (
          <div className="row gap-8">
            <button className="btn btn-ghost" onClick={() => startNew('investment')}>
              <Icon.plus width={16} height={16} /> Investment
            </button>
            <button className="btn btn-primary" onClick={() => startNew('income')}>
              <Icon.plus width={16} height={16} /> Record Income
            </button>
          </div>
        )}
      </div>

      <div className="card mt-24">
        {rows.length === 0 ? (
          <div className="empty">No income or investment recorded yet.</div>
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Type</th>
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
                  <td className="mono small bold" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/income/${d.id}`)}>
                    {d.docNumber}
                  </td>
                  <td className="small nowrap">{formatDate(d.date)}</td>
                  <td>
                    <span className={`badge ${d.kind === 'investment' ? 'badge-teal' : 'badge-green'}`}>
                      {d.kind === 'investment' ? 'Investment' : 'Income'}
                    </span>
                    {reversed && <span className="badge badge-gray" style={{ marginLeft: 8 }}>Reversed</span>}
                  </td>
                  <td>{d.description}</td>
                  <td className="small">{headName(d.headId)}</td>
                  <td className="small">{accName(d.accountId)}</td>
                  <td className="text-right nowrap ledger-in">{formatMoney(d.amount, d.currency)}</td>
                  <td className="text-right nowrap">
                    <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/finance/income/${d.id}`)} title="View receipt">
                        <Icon.eye width={14} height={14} />
                      </button>
                      {canManage && !reversed && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setReverseDoc(d)} title="Reverse">
                          <Icon.x width={14} height={14} />
                        </button>
                      )}
                    </div>
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
          title={form.kind === 'investment' ? 'Record Investment / Capital' : 'Record Income'}
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
            <input
              className="input"
              autoFocus
              value={form.description}
              onChange={(e) => upd('description', e.target.value)}
              placeholder={form.kind === 'investment' ? 'e.g. Director capital injection' : 'e.g. Project milestone payment'}
            />
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
            <FxRateField currency={form.currency} rate={form.fxRate} onRate={(v) => upd('fxRate', v)} amount={form.amount} />
            <div className="field">
              <label>{form.kind === 'investment' ? 'Investment Head' : 'Income Head'}</label>
              <select className="select" value={form.headId} onChange={(e) => upd('headId', e.target.value)}>
                {formHeads.length === 0 && <option value="">— No head configured —</option>}
                {formHeads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Deposited To</label>
              <select className="select" value={form.accountId} onChange={(e) => upd('accountId', e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Received From (optional)</label>
              <input className="input" value={form.party} onChange={(e) => upd('party', e.target.value)} />
            </div>
          </div>
          <AttachmentField label="Attach receipt / proof (optional)" value={form.attachments} onChange={(a) => upd('attachments', a)} />
        </Modal>
      )}

      {reverseDoc && (
        <ReverseModal
          label={`${reverseDoc.kind === 'investment' ? 'investment' : 'income'} ${reverseDoc.docNumber}`}
          onCancel={() => setReverseDoc(null)}
          onConfirm={(reason) => {
            reverseFinDoc(reverseDoc.id, reason)
            setReverseDoc(null)
            toast.success('Entry reversed.')
          }}
        />
      )}
    </div>
  )
}
