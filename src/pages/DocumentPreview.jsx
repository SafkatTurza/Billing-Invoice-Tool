import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { can } from '../lib/roles.js'
import { metaFor } from '../lib/docmeta.js'
import { calcTotals, lineAmount, milestoneStatus } from '../lib/pricing.js'
import { amountInWords } from '../lib/amountInWords.js'
import { formatMoney, formatDate, todayISO } from '../lib/format.js'
import { generateReceiptRef } from '../lib/numbering.js'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'
import { Icon } from '../components/Icons.jsx'
import '../styles/preview.css'

export default function DocumentPreview({ type }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { docs, company, style, currentUser, saveDocument, deleteDocument, addAudit, notify } = useApp()
  const toast = useToast()
  const meta = metaFor(type)

  const doc = docs.find((d) => d.id === id)
  const [payOpen, setPayOpen] = useState(false)

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

  const brand = style.brandColor || '#1E2D5A'
  const font = style.documentFont || 'Arial'
  const totals = meta.kind === 'receipt' ? { grandTotal: Number(doc.receivedAmount) || 0 } : calcTotals(doc)
  const isInvoice = type === 'invoices'
  const canMarkPaid = isInvoice && can(currentUser.role, 'markPaid') && doc.status !== 'Paid'
  const canDelete = can(currentUser.role, 'deleteDocuments')

  const confirmPaid = (payload) => {
    // Update invoice status + create auto-receipt (Addendum 23).
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
            {doc.paidInfo && (
              <span className="small muted">Receipt {doc.paidInfo.receiptRef}</span>
            )}
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
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / Save PDF
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

      {/* ── The printable document ── */}
      <div className="doc-paper" style={{ fontFamily: font }}>
        <div className="doc-banner" style={{ background: brand }}>
          <div className="db-company">
            <div className="db-logo">
              {doc.footer.logo ? <img src={doc.footer.logo} alt="" /> : (doc.footer.name || 'D')[0]}
            </div>
            <div>
              <h1>{doc.footer.name || company.name}</h1>
              {doc.footer.website && <div style={{ opacity: 0.85, fontSize: 12 }}>{doc.footer.website}</div>}
            </div>
          </div>
          <div className="db-type">
            <div className="t">{meta.singular}</div>
            <div className="n mono">{doc.docNumber}</div>
          </div>
        </div>

        <div className="doc-inner">
          {doc.status === 'Paid' && (
            <div style={{ marginBottom: 18 }}>
              <span className="paid-stamp">
                <Icon.check width={18} height={18} /> Paid
              </span>
            </div>
          )}

          {/* meta grid */}
          <div className="doc-meta-grid">
            <div>
              <div className="doc-section-label" style={{ color: brand }}>
                {meta.partyLabel}
              </div>
              <div className="doc-party-name">{doc.partyName || '—'}</div>
              {doc.contactPerson && (
                <div className="doc-meta-line">
                  {doc.contactPerson}
                  {doc.designation ? `, ${doc.designation}` : ''}
                </div>
              )}
              {doc.partyAddress && <div className="doc-meta-line" style={{ whiteSpace: 'pre-wrap' }}>{doc.partyAddress}</div>}
              {doc.partyPhone && <div className="doc-meta-line">{doc.partyPhone}</div>}
              {doc.partyEmail && <div className="doc-meta-line">{doc.partyEmail}</div>}
              {doc.vatNo && <div className="doc-meta-line">VAT: {doc.vatNo}</div>}
              {doc.taxId && <div className="doc-meta-line">TIN: {doc.taxId}</div>}
            </div>
            <div>
              <div className="doc-section-label" style={{ color: brand }}>
                Document Details
              </div>
              <div className="doc-meta-line">
                <b>Date:</b> {formatDate(doc.date)}
              </div>
              {meta.dueLabel && doc.dueDate && (
                <div className="doc-meta-line">
                  <b>{meta.dueLabel}:</b> {formatDate(doc.dueDate)}
                </div>
              )}
              {doc.reference && (
                <div className="doc-meta-line">
                  <b>Reference:</b> {doc.reference}
                </div>
              )}
              {doc.projectName && (
                <div className="doc-meta-line">
                  <b>Project:</b> {doc.projectName}
                </div>
              )}
              {doc.paymentTerms && (
                <div className="doc-meta-line">
                  <b>Payment Terms:</b> {doc.paymentTerms}
                </div>
              )}
              {doc.deliveryTo && (
                <div className="doc-meta-line">
                  <b>{meta.deliveryLabel}:</b> {doc.deliveryTo}
                </div>
              )}
              <div className="doc-meta-line">
                <b>Currency:</b> {doc.currency}
              </div>
            </div>
          </div>

          {/* body */}
          {meta.kind === 'receipt' ? (
            <ReceiptBody doc={doc} brand={brand} totals={totals} />
          ) : (
            <>
              <table className="doc-items">
                <thead>
                  <tr style={{ background: brand }}>
                    <th style={{ width: 34 }}>#</th>
                    <th>Description</th>
                    {meta.kind === 'po' && doc.showSpec && <th>Spec</th>}
                    <th className="num">Qty</th>
                    <th>Unit</th>
                    <th className="num">Rate</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(doc.items || []).map((it, i) => (
                    <tr key={it.id}>
                      <td>{i + 1}</td>
                      <td>
                        <div className="it-name">{it.name || '—'}</div>
                        {it.description && <div className="it-desc">{it.description}</div>}
                      </td>
                      {meta.kind === 'po' && doc.showSpec && <td>{it.spec}</td>}
                      <td className="num">{it.qty || '—'}</td>
                      <td>{it.unit}</td>
                      <td className="num">{Number(it.rate) > 0 ? formatMoney(it.rate, doc.currency) : '—'}</td>
                      <td className="num">{formatMoney(lineAmount(it), doc.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="doc-totals">
                <div className="dt-box">
                  <div className="dt-row">
                    <span>Subtotal</span>
                    <span>{formatMoney(totals.subtotal, doc.currency)}</span>
                  </div>
                  {doc.discountOn && (
                    <div className="dt-row">
                      <span>Discount ({doc.discountRate || 0}%)</span>
                      <span>− {formatMoney(totals.discountAmount, doc.currency)}</span>
                    </div>
                  )}
                  {doc.aitOn && (
                    <>
                      <div className="dt-row">
                        <span>AIT / TAX ({doc.aitRate || 0}%)</span>
                        <span>{formatMoney(totals.aitAmount, doc.currency)}</span>
                      </div>
                      <div className="dt-row">
                        <span>VAT ({doc.vatRate || 0}%)</span>
                        <span>{formatMoney(totals.vatAmount, doc.currency)}</span>
                      </div>
                    </>
                  )}
                  <div className="dt-row grand" style={{ borderColor: brand, color: brand }}>
                    <span>Grand Total</span>
                    <span>{formatMoney(totals.grandTotal, doc.currency)}</span>
                  </div>
                </div>
              </div>

              <div className="doc-words" style={{ borderColor: brand }}>
                <b style={{ color: brand }}>Amount in Words:</b> {amountInWords(totals.grandTotal, doc.currency)}
              </div>

              {meta.kind === 'po' && doc.milestones?.some((m) => m.description || m.percentage) && (
                <div style={{ marginBottom: 22 }}>
                  <div className="doc-section-label" style={{ color: brand }}>
                    Payment Milestones
                  </div>
                  {doc.milestones.map((m) => (
                    <div key={m.id} className="milestone-preview-row">
                      <span>{m.description || '—'}</span>
                      <span>
                        {m.percentage || 0}% ·{' '}
                        {formatMoney((totals.grandTotal * (Number(m.percentage) || 0)) / 100, doc.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {doc.bankOn && doc.bank?.bankName && (
                <div style={{ marginBottom: 22 }}>
                  <div className="doc-section-label" style={{ color: brand }}>
                    Bank Information
                  </div>
                  <div className="doc-meta-line">{doc.bank.bankName}</div>
                  {doc.bank.accountName && <div className="doc-meta-line">A/C Name: {doc.bank.accountName}</div>}
                  {doc.bank.accountNumber && <div className="doc-meta-line">A/C No: {doc.bank.accountNumber}</div>}
                  {doc.bank.branch && <div className="doc-meta-line">Branch: {doc.bank.branch}</div>}
                  {doc.bank.swift && <div className="doc-meta-line">Swift: {doc.bank.swift}</div>}
                </div>
              )}
            </>
          )}

          {doc.notes && (
            <div className="doc-notes">
              <div className="doc-section-label" style={{ color: brand }}>
                Notes / Terms
              </div>
              <div className="nt-body">{doc.notes}</div>
            </div>
          )}

          {/* signatures */}
          {doc.signatures?.length > 0 && (
            <div
              className="doc-sigs"
              style={{ gridTemplateColumns: `repeat(${Math.min(doc.signatures.length, 3)}, 1fr)` }}
            >
              {doc.signatures.map((s) => (
                <div key={s.id} className="doc-sig">
                  <div className="sig-line" style={{ borderColor: brand }}>
                    <div className="sig-label" style={{ color: brand }}>
                      {s.label}
                    </div>
                    {s.name && <div className="sig-name">{s.name}</div>}
                    {s.designation && <div className="sig-desig">{s.designation}</div>}
                    {s.date && <div className="sig-desig">{formatDate(s.date)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* footer */}
          <div className="doc-footer" style={{ borderColor: brand }}>
            <div>
              <div className="bold" style={{ color: '#111' }}>
                {doc.footer.name || company.name}
              </div>
              {doc.footer.address && <div style={{ whiteSpace: 'pre-wrap' }}>{doc.footer.address}</div>}
              <div>
                {[doc.footer.phone, doc.footer.email, doc.footer.website].filter(Boolean).join('  ·  ')}
              </div>
            </div>
          </div>
          <div className="doc-page-num">Page 1 of 1</div>
        </div>
      </div>

      {payOpen && <MarkPaidModal doc={doc} totals={totals} onClose={() => setPayOpen(false)} onConfirm={confirmPaid} />}
    </div>
  )
}

function ReceiptBody({ doc, brand, totals }) {
  return (
    <>
      <div className="doc-totals" style={{ justifyContent: 'flex-start' }}>
        <div className="dt-box" style={{ width: '100%' }}>
          <div className="dt-row grand" style={{ borderColor: brand, color: brand }}>
            <span>Amount Received</span>
            <span>{formatMoney(totals.grandTotal, doc.currency)}</span>
          </div>
        </div>
      </div>
      <div className="doc-words" style={{ borderColor: brand }}>
        <b style={{ color: brand }}>Amount in Words:</b> {amountInWords(totals.grandTotal, doc.currency)}
      </div>
      <div className="doc-meta-grid">
        <div>
          <div className="doc-section-label" style={{ color: brand }}>
            Payment Details
          </div>
          <div className="doc-meta-line"><b>Method:</b> {doc.paymentMethod}</div>
          {doc.paymentPurpose && <div className="doc-meta-line"><b>Purpose:</b> {doc.paymentPurpose}</div>}
          {doc.transactionDate && <div className="doc-meta-line"><b>Txn Date:</b> {formatDate(doc.transactionDate)}</div>}
        </div>
        <div>
          <div className="doc-section-label" style={{ color: brand }}>
            Bank / Transaction
          </div>
          {doc.bankName && <div className="doc-meta-line"><b>Bank:</b> {doc.bankName}</div>}
          {doc.branch && <div className="doc-meta-line"><b>Branch:</b> {doc.branch}</div>}
          {doc.chequeNo && <div className="doc-meta-line"><b>Cheque No:</b> {doc.chequeNo}</div>}
          {doc.refNo && <div className="doc-meta-line"><b>Ref No:</b> {doc.refNo}</div>}
        </div>
      </div>
    </>
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
      <div className="small muted">
        A short auto-receipt will be generated automatically and recorded in the Audit Log.
      </div>
    </Modal>
  )
}
