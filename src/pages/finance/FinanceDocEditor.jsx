import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { FIN_TYPES, newFinDoc, newReqItem, newVoucherLine, requisitionTotal, voucherTotal, FIN_STATUS, pushTimeline, docAmount, needsFxRate, rebuildVoucherSlots, VOUCHER_PAYMENT_METHODS, voucherDirection, isPrimary, voucherLabel, isVoucherType } from '../../lib/finance.js'
import { CURRENCIES } from '../../lib/format.js'
import { amountInWords } from '../../lib/amountInWords.js'
import AttachmentField from '../../components/AttachmentField.jsx'
import FxRateField from '../../components/finance/FxRateField.jsx'
import AutoTextarea from '../../components/AutoTextarea.jsx'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/documents.css'

export default function FinanceDocEditor({ type }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { finDocs, saveFinDoc, templates, saveTemplate, notifyNextApprovers } = useFinance()
  const { company, currentUser } = useApp()
  const toast = useToast()
  const meta = FIN_TYPES[type]

  const existing = id ? finDocs.find((d) => d.id === id) : null
  const [doc, setDoc] = useState(() => existing || newFinDoc(type, company, currentUser))
  const [tplOpen, setTplOpen] = useState(false)
  const [tplName, setTplName] = useState('')

  const patch = (c) => setDoc((p) => ({ ...p, ...c }))
  const isReq = type === 'requisition'
  const myTemplates = templates.filter((t) => t.kind === type)

  const save = (goPreview) => {
    if (needsFxRate(doc)) return toast.error(`Enter the ${doc.currency} → BDT exchange rate.`)
    // A money-receipt voucher pays an external party — the receipt and receiver
    // must be captured before it can be routed for approval.
    if (!isReq && doc.moneyReceipt) {
      if (!(doc.attachments?.length > 0)) return toast.error('Attach the money receipt before submitting.')
      if (!(doc.receiverName || '').trim()) return toast.error('Enter who received the payment.')
    }
    // A linked/internal voucher documents an existing transaction — it must
    // reference the primary voucher it belongs to.
    if (isVoucherType(type) && !isPrimary(doc) && !doc.linkedVoucherId) {
      return toast.error('Select the primary voucher this linked record belongs to.')
    }
    const total = isReq ? requisitionTotal(doc) : voucherTotal(doc)
    // Keep the single amount field in sync with an itemised breakdown, so the
    // list, preview, and ledger all agree on the effective total.
    const amount = isReq ? doc.amount : total
    // Submitting for approval moves Draft → Pending (also covers resubmitting a
    // sent-back doc), recording a timeline event and pinging the next approvers.
    const submitting = doc.status === FIN_STATUS.DRAFT
    const status = submitting ? FIN_STATUS.PENDING : doc.status
    const timeline = submitting ? pushTimeline(doc, 'submitted', '', currentUser) : doc.timeline
    const saved = saveFinDoc({ ...doc, total, amount, status, timeline })
    if (submitting && meta.approvable) notifyNextApprovers(saved)
    toast.success(`${meta.label} saved — routed for approval.`)
    navigate(goPreview ? `/finance/${type}/${saved.id}` : `/finance/${type}`)
  }

  const applyTemplate = (tpl) => {
    if (isReq) patch({ items: tpl.items?.map((it) => ({ ...it, id: newReqItem().id })) || doc.items, title: tpl.title || doc.title })
    else patch({ purpose: tpl.purpose || doc.purpose, headId: tpl.headId || doc.headId, paymentMethod: tpl.paymentMethod || doc.paymentMethod })
    toast.success('Template applied.')
  }

  const saveAsTemplate = () => {
    if (!tplName.trim()) return
    const tpl = { kind: type, name: tplName.trim() }
    if (isReq) {
      tpl.title = doc.title
      tpl.items = doc.items.map((it) => ({ ...it, finalAmount: '', calcAmount: '' }))
    } else {
      tpl.purpose = doc.purpose
      tpl.headId = doc.headId
      tpl.paymentMethod = doc.paymentMethod
    }
    saveTemplate(tpl)
    setTplOpen(false)
    setTplName('')
    toast.success('Template saved.')
  }

  return (
    <div>
      <div className="editor-head">
        <div>
          <h1 className="page-title">
            {existing ? 'Edit' : 'New'} {meta.label}
          </h1>
          <p className="page-sub mono">{doc.docNumber}</p>
        </div>
        <div className="row gap-8 center wrap">
          {myTemplates.length > 0 && (
            <select
              className="select"
              style={{ width: 190 }}
              defaultValue=""
              onChange={(e) => {
                const t = myTemplates.find((x) => x.id === e.target.value)
                if (t) applyTemplate(t)
                e.target.value = ''
              }}
            >
              <option value="">Use a template…</option>
              {myTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-ghost" onClick={() => setTplOpen(true)}>
            Save as Template
          </button>
          <button className="btn btn-ghost" onClick={() => navigate(`/finance/${type}`)}>
            Back
          </button>
          <button className="btn btn-primary" onClick={() => save(true)}>
            <Icon.check width={16} height={16} /> Save & Submit
          </button>
        </div>
      </div>

      {/* Common header */}
      <div className="form-section">
        <h3>Document Information</h3>
        <div className="grid grid-3">
          <div className="field">
            <label>Number</label>
            <input className="input mono" value={doc.docNumber} onChange={(e) => patch({ docNumber: e.target.value, autoNumber: false })} />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" className="input" value={doc.date} onChange={(e) => patch({ date: e.target.value })} />
          </div>
          <div className="field">
            <label>Currency</label>
            <select className="select" value={doc.currency} onChange={(e) => patch({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <FxRateField
            currency={doc.currency}
            rate={doc.fxRate}
            onRate={(v) => patch({ fxRate: v })}
            amount={docAmount(doc)}
          />
        </div>
      </div>

      {isReq ? <RequisitionBody doc={doc} patch={patch} /> : <VoucherBody doc={doc} patch={patch} />}

      {/* Attachments */}
      <div className="form-section">
        <h3>Supporting Documents</h3>
        <AttachmentField
          label="Attach bills, receipts, or scanned copies (PDF/image, max 2 MB each, multiple allowed)"
          value={doc.attachments}
          onChange={(atts) => patch({ attachments: atts })}
        />
      </div>

      <div className="form-section">
        <h3>Notes</h3>
        <AutoTextarea value={doc.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Optional notes" minHeight={60} />
      </div>

      <div className="row gap-12 mt-16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={() => navigate(`/finance/${type}`)}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={() => save(true)}>
          <Icon.check width={16} height={16} /> Save & Submit for Approval
        </button>
      </div>

      {tplOpen && (
        <Modal
          title="Save as Template"
          onClose={() => setTplOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setTplOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveAsTemplate}>
                Save Template
              </button>
            </>
          }
        >
          <p className="muted small" style={{ marginBottom: 12 }}>
            Saves this document's structure (fields/line rows, no amounts) so you can reuse it for future{' '}
            {meta.plural.toLowerCase()}.
          </p>
          <div className="field">
            <label>Template Name</label>
            <input className="input" autoFocus value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Field Visit Requisition" />
          </div>
        </Modal>
      )}
    </div>
  )
}

function RequisitionBody({ doc, patch }) {
  const items = doc.items || []
  const updItem = (rowId, c) => patch({ items: items.map((it) => (it.id === rowId ? { ...it, ...c } : it)) })
  const addItem = () => patch({ items: [...items, newReqItem()] })
  const removeItem = (rowId) => patch({ items: items.filter((it) => it.id !== rowId) })
  const total = requisitionTotal(doc)

  return (
    <>
      <div className="form-section">
        <h3>Requisition Details</h3>
        <div className="grid grid-3">
          <div className="field">
            <label>Title / Subject</label>
            <input className="input" value={doc.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Field Visit" />
          </div>
          <div className="field">
            <label>Department</label>
            <input className="input" value={doc.department} onChange={(e) => patch({ department: e.target.value })} />
          </div>
          <div className="field">
            <label>Proposed By</label>
            <input className="input" value={doc.requester} onChange={(e) => patch({ requester: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3>
          Items
          <button className="btn btn-ghost btn-sm" onClick={addItem}>
            <Icon.plus width={14} height={14} /> Add Item
          </button>
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th style={{ width: '18%' }}>Title</th>
                <th>Description</th>
                <th style={{ width: 60 }}>Qty</th>
                <th style={{ width: 110 }}>Calculated Amt</th>
                <th style={{ width: 110 }}>Final Amount</th>
                <th style={{ width: '18%' }}>Remarks</th>
                <th style={{ width: 34 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td style={{ textAlign: 'center', color: 'var(--text-faint)' }}>{i + 1}</td>
                  <td>
                    <input value={it.title} onChange={(e) => updItem(it.id, { title: e.target.value })} />
                  </td>
                  <td>
                    <AutoTextarea className="" minHeight={34} value={it.description} onChange={(e) => updItem(it.id, { description: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" value={it.qty} onChange={(e) => updItem(it.id, { qty: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" value={it.calcAmount} onChange={(e) => updItem(it.id, { calcAmount: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" value={it.finalAmount} onChange={(e) => updItem(it.id, { finalAmount: e.target.value })} />
                  </td>
                  <td>
                    <AutoTextarea className="" minHeight={34} value={it.remarks} onChange={(e) => updItem(it.id, { remarks: e.target.value })} />
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm" style={{ padding: '5px 8px' }} onClick={() => removeItem(it.id)} disabled={items.length === 1}>
                      <Icon.x width={13} height={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals-box mt-16">
          <div className="totals-row grand">
            <span>Total Cost</span>
            <span>
              {total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {doc.currency}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

function VoucherBody({ doc, patch }) {
  const { accounts, heads, employees, finDocs } = useFinance()
  const isDebit = doc.voucherType === 'debit'
  const isCash = doc.voucherType === 'cash'
  const isReceipt = voucherDirection(doc) === 'in' // cash receipt = money IN
  const linked = !isPrimary(doc)
  const expenseHeads = heads.filter((h) => h.kind === 'expense')
  const lines = doc.lines || []
  const method = doc.paymentMethod
  const isCheque = method === 'Cheque'
  const isBeftn = method === 'BEFTN'
  const isCard = method === 'Card'
  const isOnline = method === 'Online / MFS'
  const showBank = isCheque || method === 'Bank Transfer' || isBeftn
  const showAcctNo = method === 'Bank Transfer' || isBeftn
  const total = voucherTotal(doc)
  const anySigned = (doc.signSlots || []).some((s) => s.signed)
  // Toggling receiver mode / the 5th signatory reorders or resizes the approval
  // chain, so rebuild the (still empty) slots to match. Locked once signing has
  // begun. Money receipts only apply to money-OUT vouchers.
  const setReceiverMode = (on) => patch({ moneyReceipt: on, signSlots: rebuildVoucherSlots({ ...doc, moneyReceipt: on }) })
  const setExtraApprover = (on) => patch({ extraApprover: on, signSlots: rebuildVoucherSlots({ ...doc, extraApprover: on }) })
  // Cash vouchers are physical cash, so fix the mode to Cash on switch.
  const setVoucherType = (vt) => patch({ voucherType: vt, paymentMethod: vt === 'cash' ? 'Cash' : doc.paymentMethod })
  // A cash receipt brings money in and never uses an external money receipt;
  // clearing it rebuilds the (still empty) approval slots to match.
  const setCashDirection = (cd) => {
    const receiptOff = cd === 'receipt' ? false : doc.moneyReceipt
    patch({ cashDirection: cd, moneyReceipt: receiptOff, signSlots: rebuildVoucherSlots({ ...doc, moneyReceipt: receiptOff }) })
  }

  // Existing primary vouchers a linked/internal record can attach to.
  const primaryVouchers = finDocs.filter(
    (d) => isVoucherType(d.type) && isPrimary(d) && !d.deleted && d.id !== doc.id && (d.transactionId || d.docNumber),
  )
  const setFinancialRole = (role) => {
    if (role === 'primary') return patch({ financialRole: 'primary', linkedVoucherId: '', linkedVoucherType: '', linkedVoucherNumber: '', transactionId: doc.autoNumber ? '' : doc.transactionId })
    patch({ financialRole: 'linked' })
  }
  const onSelectPrimary = (pid) => {
    if (!pid) return patch({ linkedVoucherId: '', linkedVoucherType: '', linkedVoucherNumber: '', transactionId: '' })
    const p = finDocs.find((d) => d.id === pid)
    if (!p) return
    // Inherit the primary's grouping id so both documents share one Transaction ID.
    patch({ linkedVoucherId: p.id, linkedVoucherType: p.voucherType || 'payment', linkedVoucherNumber: p.docNumber, transactionId: p.transactionId || '' })
  }

  // Approved requisitions this voucher can settle.
  const approvedReqs = finDocs.filter((d) => d.type === 'requisition' && d.status === FIN_STATUS.APPROVED && !d.deleted)

  // Accounts/Super Admin select the employee this voucher relates to (optional —
  // vouchers can also be raised for non-employee payees).
  const onSelectEmployee = (empId) => {
    if (!empId) return patch({ employeeId: '', empId: '', employeeName: '' })
    const emp = employees.find((e) => e.id === empId)
    if (!emp) return
    patch({
      employeeId: emp.id,
      empId: emp.empId,
      employeeName: emp.name,
      // Prefill "received from" when it's blank, for convenience.
      receivedFrom: doc.receivedFrom || emp.name,
    })
  }

  const onSelectReq = (reqId) => {
    if (!reqId) return patch({ requisitionId: '', requisitionNumber: '' })
    const req = finDocs.find((d) => d.id === reqId)
    if (!req) return
    patch({
      requisitionId: req.id,
      requisitionNumber: req.docNumber,
      // Fill blanks from the requisition for convenience.
      purpose: doc.purpose || req.title || '',
      amount: doc.amount || req.total || '',
    })
  }

  // Breakdown lines
  const updLine = (rowId, c) => patch({ lines: lines.map((l) => (l.id === rowId ? { ...l, ...c } : l)) })
  const addLine = () => patch({ lines: [...lines, newVoucherLine()] })
  const removeLine = (rowId) => patch({ lines: lines.filter((l) => l.id !== rowId) })

  return (
    <div className="form-section">
      <h3>{voucherLabel(doc)} Details</h3>

      {/* Payment / Cash / Debit — one type, chosen here. */}
      <div className="field">
        <label>Voucher Type</label>
        <div className="row gap-16" style={{ flexWrap: 'wrap' }}>
          <label className="row gap-8 center" style={{ cursor: 'pointer' }}>
            <input type="radio" name="voucherType" checked={doc.voucherType === 'payment'} onChange={() => setVoucherType('payment')} />
            Payment Voucher <span className="muted small">(money paid out)</span>
          </label>
          <label className="row gap-8 center" style={{ cursor: 'pointer' }}>
            <input type="radio" name="voucherType" checked={isCash} onChange={() => setVoucherType('cash')} />
            Cash Voucher <span className="muted small">(physical cash)</span>
          </label>
          <label className="row gap-8 center" style={{ cursor: 'pointer' }}>
            <input type="radio" name="voucherType" checked={isDebit} onChange={() => setVoucherType('debit')} />
            Debit Voucher <span className="muted small">(charge to an account)</span>
          </label>
        </div>
      </div>

      {/* Cash direction — in or out. */}
      {isCash && (
        <div className="field">
          <label>Cash Direction</label>
          <div className="row gap-16" style={{ flexWrap: 'wrap' }}>
            <label className="row gap-8 center" style={{ cursor: 'pointer' }}>
              <input type="radio" name="cashDirection" checked={doc.cashDirection !== 'receipt'} onChange={() => setCashDirection('payment')} />
              Cash Payment <span className="muted small">(cash out)</span>
            </label>
            <label className="row gap-8 center" style={{ cursor: 'pointer' }}>
              <input type="radio" name="cashDirection" checked={doc.cashDirection === 'receipt'} onChange={() => setCashDirection('receipt')} />
              Cash Receipt <span className="muted small">(cash in)</span>
            </label>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            Kept separate from a Money Receipt — a Cash Receipt Voucher records physical cash coming in.
          </div>
        </div>
      )}

      {/* Primary vs Linked / internal record. Only a primary posts to the
          ledger; a linked record documents the same transaction with zero
          additional financial impact. */}
      <div className="field">
        <label>Financial Role</label>
        <div className="row gap-16" style={{ flexWrap: 'wrap' }}>
          <label className="row gap-8 center" style={{ cursor: anySigned ? 'not-allowed' : 'pointer' }}>
            <input type="radio" name="financialRole" checked={!linked} disabled={anySigned} onChange={() => setFinancialRole('primary')} />
            Primary Transaction <span className="muted small">(records to the ledger)</span>
          </label>
          <label className="row gap-8 center" style={{ cursor: anySigned ? 'not-allowed' : 'pointer' }}>
            <input type="radio" name="financialRole" checked={linked} disabled={anySigned} onChange={() => setFinancialRole('linked')} />
            Linked / Internal Record <span className="muted small">(no additional ledger impact)</span>
          </label>
        </div>
      </div>
      {linked && (
        <div className="grid grid-2">
          <div className="field">
            <label>
              Primary Voucher <span className="req">*</span>
            </label>
            <select className="select" value={doc.linkedVoucherId || ''} onChange={(e) => onSelectPrimary(e.target.value)}>
              <option value="">— Select the primary voucher —</option>
              {primaryVouchers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.docNumber} — {voucherLabel(p)} {p.transactionId ? `· ${p.transactionId}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <div className="warn-banner" style={{ margin: 0 }}>
              <b>Linked internal record — no additional financial impact.</b>{' '}
              {doc.linkedVoucherNumber
                ? `A financial transaction already exists under ${doc.linkedVoucherNumber}${doc.transactionId ? ` (${doc.transactionId})` : ''}. This document will NOT create an additional ledger transaction.`
                : 'Select the primary voucher above. This document will not post to the ledger.'}
            </div>
          </div>
        </div>
      )}

      {/* External receiver / money receipt (Phase I). Reorders the approval
          chain so the receiver is recorded before final approval. Only applies
          to money-OUT vouchers — a cash receipt brings money in. */}
      {!isReceipt && (
      <div className="field">
        <label>Payment Receiver</label>
        <label className="row gap-8 center" style={{ cursor: anySigned ? 'not-allowed' : 'pointer' }}>
          <input type="checkbox" checked={!!doc.moneyReceipt} disabled={anySigned} onChange={(e) => setReceiverMode(e.target.checked)} />
          Paid to an external party against a money receipt
          <span className="muted small">(receiver recorded before final approval)</span>
        </label>
        {anySigned && <div className="small muted" style={{ marginTop: 4 }}>Receiver mode is locked once signing has begun.</div>}
      </div>
      )}
      {!isReceipt && doc.moneyReceipt && (
        <div className="grid grid-2">
          <div className="field">
            <label>
              Received By (external) <span className="req">*</span>
            </label>
            <input
              className="input"
              value={doc.receiverName || ''}
              onChange={(e) => patch({ receiverName: e.target.value })}
              placeholder="Person / party who received the payment"
            />
          </div>
          <div className="field">
            <label>Money Receipt No.</label>
            <input className="input" value={doc.receiptNo || ''} onChange={(e) => patch({ receiptNo: e.target.value })} placeholder="receipt reference" />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <div className="small muted">
              Attach the money receipt under <b>Supporting Documents</b> below — it's required, and the approver
              (CEO / Managing Director) reviews it before final approval.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-2">
        <div className="field">
          <label>Employee (optional)</label>
          <select className="select" value={doc.employeeId || ''} onChange={(e) => onSelectEmployee(e.target.value)}>
            <option value="">— Not employee-related —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.empId} — {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{isReceipt ? 'Received from (payer)' : 'Paid to / received by'}</label>
          <input className="input" value={doc.receivedFrom} onChange={(e) => patch({ receivedFrom: e.target.value })} />
        </div>
        <div className="field">
          <label>Pays Requisition (optional)</label>
          <select className="select" value={doc.requisitionId || ''} onChange={(e) => onSelectReq(e.target.value)}>
            <option value="">— None —</option>
            {approvedReqs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.docNumber} — {r.title || 'Requisition'}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{isReceipt ? 'Received Into (Account)' : 'Payment Account'}</label>
          <select className="select" value={doc.accountId} onChange={(e) => patch({ accountId: e.target.value })}>
            <option value="">— Select account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Purpose Of</label>
        <AutoTextarea value={doc.purpose} onChange={(e) => patch({ purpose: e.target.value })} minHeight={50} />
      </div>

      {/* Payment mode + conditional reference fields. Cash vouchers are
          physical cash only, so the mode selector is hidden and fixed to Cash. */}
      <div className="grid grid-3">
        {!isCash ? (
          <div className="field">
            <label>Payment Mode</label>
            <select className="select" value={doc.paymentMethod} onChange={(e) => patch({ paymentMethod: e.target.value })}>
              {VOUCHER_PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="field">
            <label>Payment Mode</label>
            <input className="input" value="Cash (physical)" disabled />
          </div>
        )}
        <div className="field">
          <label>Dated</label>
          <input type="date" className="input" value={doc.paymentDated} onChange={(e) => patch({ paymentDated: e.target.value })} />
        </div>
        {!isCash && (
          <>
            {isCheque && (
              <div className="field">
                <label>Cheque No.</label>
                <input className="input" value={doc.chequeNo} onChange={(e) => patch({ chequeNo: e.target.value })} />
              </div>
            )}
            {(doc.paymentMethod === 'Bank Transfer') && (
              <div className="field">
                <label>Bank Txn / Ref ID</label>
                <input className="input" value={doc.bankTxnId} onChange={(e) => patch({ bankTxnId: e.target.value })} placeholder="transaction reference" />
              </div>
            )}
            {isBeftn && (
              <div className="field">
                <label>BEFTN Reference</label>
                <input className="input" value={doc.beftnRef} onChange={(e) => patch({ beftnRef: e.target.value })} placeholder="BEFTN batch / ref" />
              </div>
            )}
            {isCard && (
              <div className="field">
                <label>Card Reference</label>
                <input className="input" value={doc.cardRef} onChange={(e) => patch({ cardRef: e.target.value })} placeholder="card no. / auth code" />
                <div className="small muted" style={{ marginTop: 4 }}>Only the last 4 digits are shown on the printed voucher.</div>
              </div>
            )}
            {isOnline && (
              <div className="field">
                <label>Online / MFS Txn ID</label>
                <input className="input" value={doc.otherRef} onChange={(e) => patch({ otherRef: e.target.value })} placeholder="bKash / Nagad / gateway txn id" />
              </div>
            )}
            {doc.paymentMethod === 'Others' && (
              <div className="field">
                <label>Reference</label>
                <input className="input" value={doc.otherRef} onChange={(e) => patch({ otherRef: e.target.value })} placeholder="payment reference" />
              </div>
            )}
            {showAcctNo && (
              <div className="field">
                <label>Account No.</label>
                <input className="input" value={doc.payAccountNo} onChange={(e) => patch({ payAccountNo: e.target.value })} placeholder="masked on the printed voucher" />
              </div>
            )}
            {showBank && (
              <>
                <div className="field">
                  <label>Bank</label>
                  <input className="input" value={doc.bank} onChange={(e) => patch({ bank: e.target.value })} placeholder="N/A" />
                </div>
                <div className="field">
                  <label>Branch</label>
                  <input className="input" value={doc.branch} onChange={(e) => patch({ branch: e.target.value })} placeholder="N/A" />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Amount — single head, or an itemised split. */}
      {lines.length === 0 ? (
        <div className="grid grid-2">
          <div className="field">
            <label>Total Amount</label>
            <input type="number" className="input" value={doc.amount} onChange={(e) => patch({ amount: e.target.value })} />
          </div>
          <div className="field">
            <label>Expense Head</label>
            <select className="select" value={doc.headId} onChange={(e) => patch({ headId: e.target.value })}>
              <option value="">— Select head —</option>
              {expenseHeads.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="mt-8" style={{ overflowX: 'auto' }}>
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th style={{ width: '32%' }}>Expense Head</th>
                <th>Description</th>
                <th style={{ width: 130 }}>Amount ({doc.currency})</th>
                <th style={{ width: 34 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id}>
                  <td style={{ textAlign: 'center', color: 'var(--text-faint)' }}>{i + 1}</td>
                  <td>
                    <select value={l.headId} onChange={(e) => updLine(l.id, { headId: e.target.value })}>
                      <option value="">— Select head —</option>
                      {expenseHeads.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input value={l.description} onChange={(e) => updLine(l.id, { description: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" value={l.amount} onChange={(e) => updLine(l.id, { amount: e.target.value })} />
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm" style={{ padding: '5px 8px' }} onClick={() => removeLine(l.id)}>
                      <Icon.x width={13} height={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row gap-12 center mt-8" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={addLine}>
          <Icon.plus width={14} height={14} /> {lines.length === 0 ? 'Split by expense head' : 'Add head'}
        </button>
        {lines.length > 0 && (
          <div className="totals-box" style={{ minWidth: 220 }}>
            <div className="totals-row grand">
              <span>Total Amount</span>
              <span>
                {total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {doc.currency}
              </span>
            </div>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="words-box mt-8">
          <b>In words:</b> {amountInWords(total, doc.currency)}
        </div>
      )}

      {/* Signatures — the standard 4-slot chain, optionally expanded to a 5th
          approval slot signed by role/permission (max 5). */}
      <div className="field mt-16" style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 14 }}>
        <label>Signatures</label>
        <label className="row gap-8 center" style={{ cursor: anySigned ? 'not-allowed' : 'pointer' }}>
          <input type="checkbox" checked={!!doc.extraApprover} disabled={anySigned} onChange={(e) => setExtraApprover(e.target.checked)} />
          Add a 5th signatory <span className="muted small">(extra approval step, signed by role/permission)</span>
        </label>
        {doc.extraApprover && (
          <div className="field" style={{ maxWidth: 320, marginTop: 8 }}>
            <label>5th Signatory Label</label>
            <input
              className="input"
              value={doc.extraApproverLabel || ''}
              disabled={anySigned}
              onChange={(e) => patch({ extraApproverLabel: e.target.value })}
              placeholder="e.g. Additional Approver"
            />
          </div>
        )}
        <div className="small muted" style={{ marginTop: 4 }}>
          {doc.extraApprover ? 'Chain: Accountant → Checked By → 5th Signatory → ' : 'Chain: Accountant → Checked By → '}
          {doc.moneyReceipt ? 'Received Payment → Approved By' : 'Managing Director/Director → Received Payment'}.
          {anySigned ? ' Locked once signing has begun.' : ''}
        </div>
      </div>
    </div>
  )
}
