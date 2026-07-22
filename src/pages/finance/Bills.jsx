import { useState, useMemo } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { CURRENCIES, formatMoney, formatDate, todayISO } from '../../lib/format.js'
import {
  newFinDoc,
  FIN_STATUS,
  billPaid,
  billDue,
  billPayStatus,
  billOverdue,
  billAgeBucket,
  needsFxRate,
} from '../../lib/finance.js'
import AttachmentField from '../../components/AttachmentField.jsx'
import FxRateField from '../../components/finance/FxRateField.jsx'
import Modal from '../../components/Modal.jsx'
import ReverseModal from '../../components/finance/ReverseModal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'

// Phase E — Bills / Accounts Payable. A bill records money the company *owes*
// a vendor. No cash moves on save; each payment recorded against it posts a
// ledger 'out' entry, so cash-flow only reflects money actually paid.
const STATUS_BADGE = { Paid: 'badge-green', Partial: 'badge-amber', Open: 'badge-blue', Reversed: 'badge-gray' }

export default function Bills() {
  const { finDocs, heads, accounts, saveBill, recordBillPayment, reverseFinDoc } = useFinance()
  const { company, currentUser, vendors } = useApp()
  const toast = useToast()
  const canManage = can(currentUser.role, 'financeManage')
  const expenseHeads = heads.filter((h) => h.kind === 'expense')

  const [form, setForm] = useState(null) // new-bill form
  const [payFor, setPayFor] = useState(null) // bill being paid
  const [payment, setPayment] = useState(null)
  const [reverseDoc, setReverseDoc] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all') // all | outstanding | overdue | paid

  const headName = (id) => heads.find((h) => h.id === id)?.name || '—'
  const today = todayISO()

  const bills = useMemo(
    () => finDocs.filter((d) => d.type === 'bill' && !d.deleted).sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '')),
    [finDocs],
  )

  const rows = useMemo(
    () =>
      bills.filter((d) => {
        const st = billPayStatus(d)
        if (statusFilter === 'paid') return st === 'Paid'
        if (statusFilter === 'overdue') return billOverdue(d, today)
        if (statusFilter === 'outstanding') return st !== 'Paid' && st !== 'Reversed'
        return true
      }),
    [bills, statusFilter, today],
  )

  // Outstanding + overdue KPIs, grouped by currency.
  const kpi = useMemo(() => {
    const outstanding = {}
    const overdue = {}
    for (const d of bills) {
      if (d.status === FIN_STATUS.REVERSED) continue
      const due = billDue(d)
      if (due <= 0) continue
      outstanding[d.currency] = (outstanding[d.currency] || 0) + due
      if (billOverdue(d, today)) overdue[d.currency] = (overdue[d.currency] || 0) + due
    }
    return { outstanding, overdue }
  }, [bills, today])

  const startNew = () => {
    setForm({
      ...newFinDoc('bill', company, currentUser),
      date: today,
      dueDate: today,
      headId: expenseHeads[0]?.id || '',
    })
  }

  const saveNew = () => {
    if (!form.vendorName?.trim()) return toast.error('Vendor name is required.')
    if (!(Number(form.amount) > 0)) return toast.error('Enter a bill amount.')
    if (needsFxRate(form)) return toast.error(`Enter the ${form.currency} → BDT exchange rate.`)
    saveBill(form)
    toast.success('Bill recorded.')
    setForm(null)
  }

  const startPay = (bill) => {
    setPayFor(bill)
    setPayment({ date: today, amount: billDue(bill), accountId: accounts[0]?.id || '', note: '' })
  }

  const savePayment = () => {
    if (!(Number(payment.amount) > 0)) return toast.error('Enter a payment amount.')
    if (Number(payment.amount) > billDue(payFor) + 0.005) return toast.error('Payment exceeds the outstanding amount.')
    if (!payment.accountId) return toast.error('Choose the paying account.')
    recordBillPayment(payFor.id, payment)
    toast.success('Payment recorded.')
    setPayFor(null)
    setPayment(null)
  }

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const updPay = (k, v) => setPayment((p) => ({ ...p, [k]: v }))

  const CurLines = ({ map, cls, empty = '—' }) => {
    const e = Object.entries(map)
    if (!e.length) return <span className="muted">{empty}</span>
    return e.map(([c, v]) => (
      <div key={c} className={cls} style={{ fontSize: 18 }}>
        {formatMoney(v, c)}
      </div>
    ))
  }

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">Bills &amp; Payables</h1>
          <p className="page-sub">Vendor bills you owe. Cash only leaves the ledger when you record a payment against a bill.</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={startNew}>
            <Icon.plus width={16} height={16} /> New Bill
          </button>
        )}
      </div>

      <div className="fin-kpis mt-24" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 640 }}>
        <div className="fin-kpi">
          <div className="k-label">Outstanding Payables</div>
          <div className="k-val out">
            <CurLines map={kpi.outstanding} cls="out" />
          </div>
        </div>
        <div className="fin-kpi">
          <div className="k-label">Overdue</div>
          <div className="k-val" style={{ color: 'var(--red)' }}>
            <CurLines map={kpi.overdue} cls="" empty="None" />
          </div>
        </div>
      </div>

      <div className="card mt-24">
        <div className="list-toolbar" style={{ gap: 8 }}>
          <select className="select" style={{ width: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All bills</option>
            <option value="outstanding">Outstanding</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="empty">No bills{statusFilter !== 'all' ? ' match this filter' : ' recorded yet'}.</div>
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Vendor</th>
                <th>Ref</th>
                <th>Head</th>
                <th>Due</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Outstanding</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const st = billPayStatus(d)
                const over = billOverdue(d, today)
                const bucket = billAgeBucket(d, today)
                const due = billDue(d)
                return (
                  <tr key={d.id} style={st === 'Reversed' ? { opacity: 0.55 } : undefined}>
                    <td className="mono small">{d.docNumber}</td>
                    <td>{d.vendorName || '—'}</td>
                    <td className="small muted">{d.billRef || '—'}</td>
                    <td className="small">{headName(d.headId)}</td>
                    <td className="small nowrap">
                      {d.dueDate ? formatDate(d.dueDate) : '—'}
                      {over && <span className="badge badge-red" style={{ marginLeft: 6 }}>{bucket}d</span>}
                    </td>
                    <td className="text-right nowrap">{formatMoney(d.amount, d.currency)}</td>
                    <td className="text-right nowrap ledger-out">{formatMoney(billPaid(d), d.currency)}</td>
                    <td className="text-right nowrap bold">{formatMoney(due, d.currency)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[st] || 'badge-gray'}`}>{st}</span>
                    </td>
                    <td className="text-right nowrap">
                      <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                        {canManage && st !== 'Reversed' && due > 0 && (
                          <button className="btn btn-ghost btn-sm" onClick={() => startPay(d)} title="Record payment">
                            <Icon.money width={14} height={14} /> Pay
                          </button>
                        )}
                        {canManage && st !== 'Reversed' && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setReverseDoc(d)} title="Reverse bill">
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

      {/* ── New bill ── */}
      {form && (
        <Modal
          title="New Bill / Payable"
          width={580}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveNew}>
                <Icon.check width={16} height={16} /> Save Bill
              </button>
            </>
          }
        >
          <div className="grid grid-2">
            <div className="field">
              <label>
                Vendor <span className="req">*</span>
              </label>
              <input
                className="input"
                autoFocus
                list="bill-vendors"
                value={form.vendorName}
                onChange={(e) => upd('vendorName', e.target.value)}
                placeholder="e.g. City Print House"
              />
              <datalist id="bill-vendors">
                {vendors.map((v) => (
                  <option key={v.id} value={v.name} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>Vendor Bill / Ref No.</label>
              <input className="input" value={form.billRef} onChange={(e) => upd('billRef', e.target.value)} placeholder="their invoice no." />
            </div>
          </div>
          <div className="grid grid-3">
            <div className="field">
              <label>Bill Date</label>
              <input type="date" className="input" value={form.date} onChange={(e) => upd('date', e.target.value)} />
            </div>
            <div className="field">
              <label>Due Date</label>
              <input type="date" className="input" value={form.dueDate} onChange={(e) => upd('dueDate', e.target.value)} />
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
              <label>
                Amount <span className="req">*</span>
              </label>
              <input type="number" className="input" value={form.amount} onChange={(e) => upd('amount', e.target.value)} />
            </div>
            <FxRateField currency={form.currency} rate={form.fxRate} onRate={(v) => upd('fxRate', v)} amount={form.amount} />
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Expense Head</label>
              <select className="select" value={form.headId} onChange={(e) => upd('headId', e.target.value)}>
                {expenseHeads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <input className="input" value={form.description} onChange={(e) => upd('description', e.target.value)} placeholder="what the bill is for" />
          </div>
          <AttachmentField label="Attach bill / invoice (optional)" value={form.attachments} onChange={(a) => upd('attachments', a)} />
        </Modal>
      )}

      {/* ── Record payment ── */}
      {payFor && payment && (
        <Modal
          title={`Record Payment — ${payFor.docNumber}`}
          width={520}
          onClose={() => {
            setPayFor(null)
            setPayment(null)
          }}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPayFor(null)
                  setPayment(null)
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={savePayment}>
                <Icon.check width={16} height={16} /> Record Payment
              </button>
            </>
          }
        >
          <p className="small muted" style={{ marginBottom: 12 }}>
            {payFor.vendorName} · Outstanding <b>{formatMoney(billDue(payFor), payFor.currency)}</b> of {formatMoney(payFor.amount, payFor.currency)}.
            This posts a payment to the ledger from the chosen account.
          </p>
          <div className="grid grid-2">
            <div className="field">
              <label>Payment Date</label>
              <input type="date" className="input" value={payment.date} onChange={(e) => updPay('date', e.target.value)} />
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" className="input" value={payment.amount} onChange={(e) => updPay('amount', e.target.value)} />
            </div>
            <div className="field">
              <label>Paid From</label>
              <select className="select" value={payment.accountId} onChange={(e) => updPay('accountId', e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Note (optional)</label>
              <input className="input" value={payment.note} onChange={(e) => updPay('note', e.target.value)} placeholder="e.g. cheque #1234" />
            </div>
          </div>
        </Modal>
      )}

      {reverseDoc && (
        <ReverseModal
          label={`bill ${reverseDoc.docNumber}`}
          onCancel={() => setReverseDoc(null)}
          onConfirm={(reason) => {
            reverseFinDoc(reverseDoc.id, reason)
            setReverseDoc(null)
            toast.success('Bill reversed.')
          }}
        />
      )}
    </div>
  )
}
