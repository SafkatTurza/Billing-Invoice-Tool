import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { FIN_TYPES, FIN_STATUS, requisitionTotal, voucherTotal, voucherAccent, voucherLabel, isVoucherType } from '../../lib/finance.js'
import { can } from '../../lib/roles.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { amountInWords } from '../../lib/amountInWords.js'
import { AttachmentList } from '../../components/AttachmentField.jsx'
import ApprovalChain from '../../components/finance/ApprovalChain.jsx'
import ReverseModal from '../../components/finance/ReverseModal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/preview.css'
import '../../styles/finance.css'

const STATUS_BADGE = {
  [FIN_STATUS.DRAFT]: 'badge-gray',
  [FIN_STATUS.PENDING]: 'badge-amber',
  [FIN_STATUS.APPROVED]: 'badge-green',
  [FIN_STATUS.REJECTED]: 'badge-red',
  [FIN_STATUS.RECORDED]: 'badge-teal',
  [FIN_STATUS.REVERSED]: 'badge-gray',
}

export default function FinanceDocPreview({ type }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { finDocs, saveFinDoc, onDocApproved, reverseFinDoc, duplicateFinDoc } = useFinance()
  const { findCompany, currentUser } = useApp()
  const toast = useToast()
  const meta = FIN_TYPES[type]
  const canManage = can(currentUser.role, 'financeManage')
  const [reverseOpen, setReverseOpen] = useState(false)

  const doc = finDocs.find((d) => d.id === id)
  if (!doc) {
    return (
      <div className="empty">
        Not found.{' '}
        <a style={{ color: 'var(--navy)', fontWeight: 600 }} onClick={() => navigate(`/finance/${type}`)}>
          Back
        </a>
      </div>
    )
  }
  const company = findCompany(doc)

  // Atomic: save the new slots and (if this completes management approval) the
  // Approved status together, then post to the ledger once.
  const onSign = (newSlots, { completesApproval }) => {
    const patch = { signSlots: newSlots }
    if (completesApproval && doc.status !== FIN_STATUS.APPROVED) patch.status = FIN_STATUS.APPROVED
    const saved = saveFinDoc({ ...doc, ...patch })
    if (patch.status === FIN_STATUS.APPROVED) {
      onDocApproved(saved)
      toast.success(`${meta.label} approved — posted to the ledger and monthly expenditure.`)
    }
  }

  const onReverse = (reason) => {
    reverseFinDoc(doc.id, reason)
    setReverseOpen(false)
    toast.success(`${meta.label} reversed — ledger entries voided.`)
  }

  const onDuplicate = () => {
    const clone = duplicateFinDoc(doc.id)
    if (clone) {
      toast.success('Duplicated as a new draft.')
      navigate(`/finance/${isVoucherType(clone.type) ? 'voucher' : clone.type}/${clone.id}/edit`)
    }
  }

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>
            {isVoucherType(doc.type) ? voucherLabel(doc) : meta.label}{' '}
            <span className="mono muted" style={{ fontSize: 15 }}>{doc.docNumber}</span>
          </h1>
          <div className="mt-8">
            <span className={`badge ${STATUS_BADGE[doc.status] || 'badge-gray'}`}>{doc.status}</span>
          </div>
        </div>
        <div className="row gap-8 wrap">
          <button className="btn btn-ghost" onClick={() => navigate(`/finance/${type}`)}>
            Back
          </button>
          {canManage && (doc.status === FIN_STATUS.DRAFT || doc.status === FIN_STATUS.PENDING) ? (
            <button className="btn btn-ghost" onClick={() => navigate(`/finance/${type}/${doc.id}/edit`)}>
              <Icon.edit width={15} height={15} /> Edit
            </button>
          ) : null}
          {canManage && (
            <button className="btn btn-ghost" onClick={onDuplicate} title="Create a new draft from this document">
              <Icon.invoice width={15} height={15} /> Duplicate
            </button>
          )}
          {canManage && doc.status === FIN_STATUS.APPROVED && (
            <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setReverseOpen(true)}>
              <Icon.x width={15} height={15} /> Reverse
            </button>
          )}
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
        </div>
      </div>

      {doc.status === FIN_STATUS.REVERSED && (
        <div className="auth-error no-print" style={{ marginBottom: 18 }}>
          <b>Reversed</b> by {doc.reversedBy || 'Unknown'} on {formatDate(doc.reversedAt)} — its ledger entries were voided.
          {doc.reversalReason ? <div style={{ marginTop: 4 }}>Reason: {doc.reversalReason}</div> : null}
        </div>
      )}

      {/* Approval chain (interactive) — hidden once reversed */}
      {meta.approvable && doc.status !== FIN_STATUS.REVERSED && (
        <div className="card card-pad no-print" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Approval Chain</h3>
          <p className="small muted mb-16">
            Signatures are applied in order; management (CEO/MD) signs last. Once the final signature is
            applied, this document is approved and its amount is added to expenses.
          </p>
          <ApprovalChain
            type={type}
            slots={doc.signSlots}
            onSign={onSign}
            readOnly={doc.status === FIN_STATUS.REJECTED}
          />
        </div>
      )}

      {/* Attachments */}
      {doc.attachments?.length > 0 && (
        <div className="card card-pad no-print" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
            Supporting Documents ({doc.attachments.length})
          </h3>
          <AttachmentList value={doc.attachments} />
        </div>
      )}

      {/* Printable letterhead copy */}
      <div className="fin-paper">
        {doc.type === 'requisition' ? (
          <RequisitionPaper doc={doc} company={company} />
        ) : (
          <VoucherPaper doc={doc} company={company} />
        )}
      </div>

      {reverseOpen && (
        <ReverseModal
          label={`${meta.label} ${doc.docNumber}`}
          onCancel={() => setReverseOpen(false)}
          onConfirm={onReverse}
        />
      )}
    </div>
  )
}

function Letterhead({ company, title, ref, date }) {
  return (
    <>
      <div className="fin-letterhead">
        <div style={{ width: 60 }} />
        <div className="fl-center">
          <div className="fl-co">{company.name}</div>
          <div className="fl-title">{title}</div>
          {ref && <div className="fl-ref mono">Ref ID: {ref}</div>}
        </div>
        <div className="fl-logo">{company.logo ? <img src={company.logo} alt="" /> : (company.name || 'D')[0]}</div>
      </div>
      <div className="fin-date-line">Date: {formatDate(date)}</div>
    </>
  )
}

function SignRow({ slots }) {
  return (
    <div className="fin-sign-row" style={{ gridTemplateColumns: `repeat(${slots.length}, 1fr)` }}>
      {slots.map((s, i) => (
        <div key={i} className="fin-sign">
          {s.signed && s.signatureImg ? (
            <img src={s.signatureImg} alt="" className="fs-img" />
          ) : (
            <div style={{ height: 44 }} />
          )}
          <div className="fs-line">{s.label}</div>
          {s.signed && <div className="fs-date">{formatDate(s.date)}</div>}
        </div>
      ))}
    </div>
  )
}

function RequisitionPaper({ doc, company }) {
  const total = requisitionTotal(doc)
  return (
    <div>
      <Letterhead company={company} title="Office Requisition" ref={doc.docNumber} date={doc.date} />
      <table className="fin-table">
        <thead>
          <tr>
            <th style={{ width: 34 }}>No.</th>
            <th style={{ width: '16%' }}>Title</th>
            <th>Descriptions</th>
            <th className="num" style={{ width: 55 }}>Qty</th>
            <th className="num" style={{ width: 95 }}>Calculated Amount ({doc.currency})</th>
            <th className="num" style={{ width: 90 }}>Final Amount ({doc.currency})</th>
            <th style={{ width: '20%' }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((it, i) => (
            <tr key={it.id}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{it.title}</td>
              <td style={{ whiteSpace: 'pre-wrap' }}>{it.description}</td>
              <td className="num">{it.qty}</td>
              <td className="num">{Number(it.calcAmount) ? Number(it.calcAmount).toLocaleString() : ''}</td>
              <td className="num">{Number(it.finalAmount) ? Number(it.finalAmount).toLocaleString() : ''}</td>
              <td style={{ whiteSpace: 'pre-wrap' }}>{it.remarks}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ textAlign: 'center' }}>Total Cost</td>
            <td className="num">{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <SignRow slots={doc.signSlots} />
      {company.address && <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 22 }}>{company.address}</div>}
    </div>
  )
}

function VoucherPaper({ doc, company }) {
  const isDebit = doc.voucherType === 'debit'
  const accent = voucherAccent(doc)
  const total = voucherTotal(doc)
  const lines = (doc.lines || []).filter((l) => Number(l.amount) > 0)
  const paymentLine = [doc.paymentMethod, doc.chequeNo && `Cheque #${doc.chequeNo}`].filter(Boolean).join(' — ') || 'N/A'
  return (
    <div>
      <div className="fin-letterhead">
        <div className="fl-logo">{company.logo ? <img src={company.logo} alt="" /> : (company.name || 'D')[0]}</div>
        <div className="fl-center">
          <div className="fl-co">{company.name}</div>
          {company.email && <div className="fl-ref">Email: {company.email}</div>}
        </div>
        <div className="voucher-badge" style={{ borderColor: accent, color: accent }}>
          {isDebit ? 'DEBIT' : 'PAYMENT'}
          <br />
          VOUCHER
        </div>
      </div>

      <div className="row between" style={{ margin: '14px 0 6px' }}>
        <div className="mono small">SL No: {doc.docNumber}</div>
        <div className="small">Date: {formatDate(doc.date)}</div>
      </div>

      {doc.employeeName && (
        <div className="voucher-row">
          <span className="vr-label">Employee</span>
          <span className="vr-fill">
            {doc.employeeName}
            {doc.empId ? ` (${doc.empId})` : ''}
          </span>
        </div>
      )}
      <div className="voucher-row">
        <span className="vr-label">Received with thanks from</span>
        <span className="vr-fill">{doc.receivedFrom}</span>
      </div>
      <div className="voucher-row">
        <span className="vr-label">Purpose OF</span>
        <span className="vr-fill" style={{ whiteSpace: 'pre-wrap' }}>{doc.purpose}</span>
      </div>
      {doc.requisitionNumber && (
        <div className="voucher-row">
          <span className="vr-label">Against Requisition</span>
          <span className="vr-fill mono">{doc.requisitionNumber}</span>
        </div>
      )}
      <div className="voucher-row">
        <span className="vr-label">By Cash/Cheque/Others</span>
        <span className="vr-fill">{paymentLine}</span>
        <span className="vr-label">Dated</span>
        <span className="vr-fill" style={{ maxWidth: 120 }}>{doc.paymentDated ? formatDate(doc.paymentDated) : 'N/A'}</span>
      </div>
      <div className="voucher-row">
        <span className="vr-label">Bank</span>
        <span className="vr-fill">{doc.bank || 'N/A'}</span>
        <span className="vr-label">Branch</span>
        <span className="vr-fill">{doc.branch || 'N/A'}</span>
      </div>

      {/* Optional per-head breakdown */}
      {lines.length > 0 && (
        <table className="fin-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 34 }}>No.</th>
              <th>Expense Head</th>
              <th>Description</th>
              <th className="num" style={{ width: 130 }}>Amount ({doc.currency})</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td><HeadName id={l.headId} /></td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{l.description}</td>
                <td className="num">{Number(l.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="voucher-row" style={{ marginTop: 12 }}>
        <span className="vr-label">Total Amount</span>
        <span style={{ border: `1px solid ${accent}`, borderRadius: 6, padding: '4px 14px', fontWeight: 800, minWidth: 120, textAlign: 'center' }}>
          {formatMoney(total, doc.currency)}
        </span>
        <span className="vr-label" style={{ marginLeft: 12 }}>Amount in Word</span>
        <span className="vr-fill" style={{ fontStyle: 'italic' }}>{amountInWords(total, doc.currency)}</span>
      </div>

      <SignRow slots={doc.signSlots} />
    </div>
  )
}

function HeadName({ id }) {
  const { heads } = useFinance()
  return <>{heads.find((h) => h.id === id)?.name || '—'}</>
}
