import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { can } from '../lib/roles.js'
import { metaFor } from '../lib/docmeta.js'
import { calcTotals } from '../lib/pricing.js'
import { formatMoney, todayISO } from '../lib/format.js'
import { newDocument, companyFooter } from '../lib/newDocument.js'
import { exportExcel, exportDocx } from '../lib/exporters.js'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import DocSkin from '../components/preview/DocSkin.jsx'
import ReceiptSkin from '../components/preview/ReceiptSkin.jsx'
import { useToast } from '../components/Toast.jsx'
import { useConfirm } from '../components/ConfirmDialog.jsx'
import { Icon } from '../components/Icons.jsx'
import '../styles/preview.css'

export default function DocumentPreview({ type }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { docs, company, style, currentUser, saveDocument, deleteDocument, findCompany, addAudit, notify } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const meta = metaFor(type)

  const doc = docs.find((d) => d.id === id)
  const [payOpen, setPayOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!doc) {
    return (
      <div className="empty">
        Document not found.{' '}
        <a style={{ color: 'var(--brand-dark)', fontWeight: 600 }} onClick={() => navigate(`/${type}`)}>
          Back to list
        </a>
      </div>
    )
  }

  const docCompany = findCompany(doc)
  // Company brand override wins over global style (matches the original).
  const brand = docCompany?.brandColor || style.brandColor || '#1E2D5A'
  const font = style.documentFont || 'Arial'
  const template = style.template || 'modern'

  const totals = meta.kind === 'receipt' ? { grandTotal: Number(doc.receivedAmount) || 0 } : calcTotals(doc)
  const isInvoice = type === 'invoices'
  const role = currentUser.role
  const status = doc.status
  // Approval → payment workflow (invoices only):
  //  Draft/Sent → Approve or Reject → Approved → Record Payment → Paid/Partial.
  const canApproveInv = isInvoice && can(role, 'approveInvoice') && (status === 'Draft' || status === 'Sent')
  const canRecordPayment = isInvoice && can(role, 'markPaid') && (status === 'Approved' || status === 'Partial')
  const canReopen = isInvoice && can(role, 'approveInvoice') && status === 'Rejected'
  const canDelete = can(role, 'deleteDocuments')

  const setStatus = (next, verb) => {
    saveDocument({ ...doc, status: next })
    addAudit(verb, doc.docNumber, doc.partyName || '')
    notify(`Invoice ${doc.docNumber} ${verb.toLowerCase()}`, doc.createdBy, `/invoices/${doc.id}`)
    toast.success(`Invoice ${verb.toLowerCase()}.`)
  }

  const runExport = async (fn, kind) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      console.error(err)
      toast.error(`${kind} export failed.`)
    } finally {
      setBusy(false)
    }
  }

  // Record a payment: auto-create a Money Receipt pre-filled from the invoice,
  // mark the invoice Paid/Partial, and open the receipt so the user can add a
  // signature and any other detail (att. 4 workflow).
  const confirmPayment = (payload) => {
    const base = newDocument('money-receipt', docCompany)
    const receipt = {
      ...base,
      companyId: doc.companyId || base.companyId,
      partyId: doc.partyId || '',
      partyName: doc.partyName || '',
      contactPerson: doc.contactPerson || '',
      partyPhone: doc.partyPhone || '',
      partyEmail: doc.partyEmail || '',
      partyAddress: doc.partyAddress || '',
      currency: doc.currency,
      date: payload.date,
      transactionDate: payload.date,
      receivedAmount: payload.amount,
      paymentMethod: payload.method,
      paymentPurpose: `Payment received against Invoice ${doc.docNumber}`,
      reference: doc.docNumber,
      relatedInvoiceId: doc.id,
      footer: companyFooter(docCompany),
    }
    const savedReceipt = saveDocument(receipt) // commits the MR number
    const fullyPaid = Number(payload.amount) >= Number(totals.grandTotal || 0)
    saveDocument({
      ...doc,
      status: fullyPaid ? 'Paid' : 'Partial',
      paidInfo: {
        receiptRef: savedReceipt.docNumber,
        receiptId: savedReceipt.id,
        amount: payload.amount,
        currency: doc.currency,
        date: payload.date,
        method: payload.method,
        notes: payload.notes,
        markedBy: currentUser.fullName,
      },
    })
    addAudit('Payment recorded', doc.docNumber, `${formatMoney(payload.amount, doc.currency)} → receipt ${savedReceipt.docNumber}`)
    notify(`Payment recorded for ${doc.docNumber} → ${savedReceipt.docNumber}`, doc.createdBy, `/money-receipt/${savedReceipt.id}`)
    toast.success(`Money Receipt ${savedReceipt.docNumber} created — add signature & any details.`)
    setPayOpen(false)
    navigate(`/money-receipt/${savedReceipt.id}/edit`)
  }

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>
            {meta.singular} <span className="mono muted" style={{ fontSize: 15 }}>{doc.docNumber}</span>
          </h1>
          <div className="row gap-8 center mt-8">
            <StatusBadge status={doc.status} />
            {doc.paidInfo && <span className="small muted">Receipt {doc.paidInfo.receiptRef}</span>}
          </div>
        </div>
        <div className="row gap-8 wrap">
          <button className="btn btn-ghost" onClick={() => navigate(`/${type}`)}>
            Back
          </button>
          <button className="btn btn-ghost" onClick={() => navigate(`/${type}/${doc.id}/edit`)}>
            <Icon.edit width={15} height={15} /> Edit
          </button>
          {canApproveInv && (
            <>
              <button className="btn btn-teal" onClick={() => setStatus('Approved', 'Approved')}>
                <Icon.check width={15} height={15} /> Approve
              </button>
              <button className="btn btn-danger" onClick={() => setStatus('Rejected', 'Rejected')}>
                <Icon.x width={15} height={15} /> Reject
              </button>
            </>
          )}
          {canReopen && (
            <button className="btn btn-ghost" onClick={() => setStatus('Draft', 'Reopened')}>
              <Icon.edit width={15} height={15} /> Reopen
            </button>
          )}
          {canRecordPayment && (
            <button className="btn btn-teal" onClick={() => setPayOpen(true)}>
              <Icon.check width={15} height={15} /> Record Payment
            </button>
          )}
          <button className="btn btn-ghost" disabled={busy} onClick={() => runExport(() => exportExcel(doc), 'Excel')}>
            <Icon.download width={15} height={15} /> Excel
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => runExport(() => exportDocx(doc, brand), 'Word')}>
            <Icon.download width={15} height={15} /> Word
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
          {canDelete && (
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Move to Recycle Bin?',
                    message: `${doc.docNumber} will be moved to the Recycle Bin. You can restore it later.`,
                    confirmLabel: 'Move to Recycle Bin',
                  })
                ) {
                  deleteDocument(doc.id)
                  navigate(`/${type}`)
                }
              }}
            >
              <Icon.trash width={15} height={15} />
            </button>
          )}
        </div>
      </div>

      {/* PAID stamp (outside the paper so skins stay pristine) */}
      {doc.status === 'Paid' && (
        <div className="no-print" style={{ maxWidth: 820, margin: '0 auto 12px' }}>
          <span className="paid-stamp">
            <Icon.check width={18} height={18} /> Paid
          </span>
        </div>
      )}

      <div className="doc-paper">
        {meta.kind === 'receipt' ? (
          <ReceiptSkin doc={doc} brand={brand} font={font} template={template} docs={docs} />
        ) : (
          <DocSkin doc={doc} brand={brand} font={font} template={template} />
        )}
        <div className="doc-page-num no-print" style={{ padding: '0 28px 16px' }}>
          Preview — printed / exported PDF paginates automatically
        </div>
      </div>

      {payOpen && <RecordPaymentModal doc={doc} totals={totals} onClose={() => setPayOpen(false)} onConfirm={confirmPayment} />}
    </div>
  )
}

// Record a payment against an approved invoice. Confirming generates a Money
// Receipt (pre-filled) and opens it for final edits (signature, etc.).
function RecordPaymentModal({ doc, totals, onClose, onConfirm }) {
  const [amount, setAmount] = useState(totals.grandTotal)
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState('Cash')
  const [notes, setNotes] = useState('')

  return (
    <Modal
      title="Record Payment"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-teal" onClick={() => onConfirm({ amount, date, method, notes })}>
            <Icon.check width={16} height={16} /> Create Money Receipt
          </button>
        </>
      }
    >
      <div className="grid grid-2">
        <div className="field">
          <label>Amount Received</label>
          <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Currency</label>
          <input className="input" value={doc.currency} disabled />
        </div>
        <div className="field">
          <label>Payment Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Payment Method</label>
          <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
            {['Cash', 'Cheque', 'Other', 'BEFTN Payment'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Notes (optional)</label>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="small muted">
        A Money Receipt will be created and pre-filled from this invoice. You can then add the signature and
        any other details before saving.
      </div>
    </Modal>
  )
}
