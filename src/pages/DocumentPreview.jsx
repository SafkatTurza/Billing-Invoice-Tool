import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { can } from '../lib/roles.js'
import { metaFor } from '../lib/docmeta.js'
import { calcTotals } from '../lib/pricing.js'
import { amountInWords } from '../lib/amountInWords.js'
import { formatMoney, formatDate, todayISO } from '../lib/format.js'
import { generateReceiptRef } from '../lib/numbering.js'
import { exportExcel, exportDocx } from '../lib/exporters.js'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import DocSkin from '../components/preview/DocSkin.jsx'
import { useToast } from '../components/Toast.jsx'
import { Icon } from '../components/Icons.jsx'
import '../styles/preview.css'

export default function DocumentPreview({ type }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { docs, company, style, currentUser, saveDocument, deleteDocument, findCompany, addAudit, notify } = useApp()
  const toast = useToast()
  const meta = metaFor(type)

  const doc = docs.find((d) => d.id === id)
  const [payOpen, setPayOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!doc) {
    return (
      <div className="empty">
        Document not found.{' '}
        <a style={{ color: 'var(--navy)', fontWeight: 600 }} onClick={() => navigate(`/${type}`)}>
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
  const canMarkPaid = isInvoice && can(currentUser.role, 'markPaid') && doc.status !== 'Paid'
  const canDelete = can(currentUser.role, 'deleteDocuments')

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

  const confirmPaid = (payload) => {
    const receiptRef = generateReceiptRef()
    const updated = {
      ...doc,
      status: 'Paid',
      paidInfo: {
        receiptRef,
        amount: payload.amount,
        currency: doc.currency,
        date: payload.date,
        method: payload.method,
        notes: payload.notes,
        markedBy: currentUser.fullName,
      },
    }
    saveDocument(updated)
    addAudit('Mark as Paid', doc.docNumber, `${formatMoney(payload.amount, doc.currency)} — auto-receipt ${receiptRef}`)
    notify(`Invoice ${doc.docNumber} marked as Paid`, doc.createdBy, `/invoices/${doc.id}`)
    toast.success(`Marked as Paid. Auto-receipt ${receiptRef} created.`)
    setPayOpen(false)
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
          {canMarkPaid && (
            <button className="btn btn-teal" onClick={() => setPayOpen(true)}>
              <Icon.check width={15} height={15} /> Mark as Paid
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
              onClick={() => {
                if (confirm(`Move ${doc.docNumber} to Recycle Bin?`)) {
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
          <ReceiptDoc doc={doc} brand={brand} font={font} totals={totals} company={docCompany} />
        ) : (
          <DocSkin doc={doc} brand={brand} font={font} template={template} />
        )}
        <div className="doc-page-num" style={{ padding: '0 28px 16px' }}>
          Page 1 of 1
        </div>
      </div>

      {payOpen && <MarkPaidModal doc={doc} totals={totals} onClose={() => setPayOpen(false)} onConfirm={confirmPaid} />}
    </div>
  )
}

// Money Receipt keeps a dedicated layout (no line items / pricing block).
function ReceiptDoc({ doc, brand, font, totals }) {
  return (
    <div style={{ fontFamily: `"${font}", sans-serif`, color: '#1e293b' }}>
      <div style={{ background: brand, padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {doc.footer.logo && <img src={doc.footer.logo} style={{ height: 34, objectFit: 'contain' }} alt="" />}
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>MONEY RECEIPT</div>
        </div>
        <div style={{ color: '#fff', textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 13 }}>{doc.docNumber}</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>{formatDate(doc.date)}</div>
        </div>
      </div>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: brand, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Received From</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{doc.partyName || '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Amount Received</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: brand }}>{formatMoney(totals.grandTotal, doc.currency)}</div>
          </div>
        </div>
        <div style={{ background: '#f6faf9', border: `1px solid ${brand}`, borderRadius: 6, padding: '9px 13px', marginBottom: 18, fontSize: 12, fontStyle: 'italic', color: brand }}>
          {amountInWords(totals.grandTotal, doc.currency)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: brand, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Payment Details</div>
            <Line k="Method" v={doc.paymentMethod} />
            <Line k="Purpose" v={doc.paymentPurpose} />
            <Line k="Txn Date" v={doc.transactionDate && formatDate(doc.transactionDate)} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: brand, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Bank / Transaction</div>
            <Line k="Bank" v={doc.bankName} />
            <Line k="Branch" v={doc.branch} />
            <Line k="Cheque No" v={doc.chequeNo} />
            <Line k="Ref No" v={doc.refNo} />
          </div>
        </div>

        {doc.signatures?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(doc.signatures.length, 3)}, 1fr)`, gap: 20, marginTop: 36 }}>
            {doc.signatures.map((s) => (
              <div key={s.id} style={{ borderTop: '1.5px solid #333', paddingTop: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: brand }}>{s.label}</div>
                {s.name && <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>}
                {s.designation && <div style={{ fontSize: 11, color: '#666' }}>{s.designation}</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: `2px solid ${brand}`, marginTop: 30, paddingTop: 14, fontSize: 11, color: '#64748b' }}>
          <b style={{ color: '#1e293b' }}>{doc.footer.name}</b>
          {doc.footer.address && <div style={{ whiteSpace: 'pre-wrap' }}>{doc.footer.address}</div>}
          <div>{[doc.footer.phone, doc.footer.email, doc.footer.website].filter(Boolean).join('  ·  ')}</div>
        </div>
      </div>
    </div>
  )
}

function Line({ k, v }) {
  if (!v) return null
  return (
    <div style={{ fontSize: 12, marginBottom: 3 }}>
      <span style={{ color: '#64748b' }}>{k}: </span>
      <span style={{ fontWeight: 500 }}>{v}</span>
    </div>
  )
}

function MarkPaidModal({ doc, totals, onClose, onConfirm }) {
  const [amount, setAmount] = useState(totals.grandTotal)
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState('Bank Transfer')
  const [notes, setNotes] = useState('')

  return (
    <Modal
      title="Mark Invoice as Paid"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-teal" onClick={() => onConfirm({ amount, date, method, notes })}>
            <Icon.check width={16} height={16} /> Confirm Payment
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
            {['Cash', 'Bank Transfer', 'BEFTN', 'Cheque', 'Other'].map((m) => (
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
      <div className="small muted">A short auto-receipt will be generated automatically and recorded in the Audit Log.</div>
    </Modal>
  )
}
