import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatMoney, formatDate } from '../../lib/format.js'
import { amountInWords } from '../../lib/amountInWords.js'
import { AttachmentList } from '../../components/AttachmentField.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/preview.css'
import '../../styles/finance.css'

const GREEN = '#059669'

// Printable receipt for a recorded income / investment entry. Money-IN records
// are entered straight to the ledger from IncomeRecords; this gives each one a
// proper, printable acknowledgement the company can hand over.
export default function IncomeReceipt() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { finDocs, heads, accounts } = useFinance()
  const { findCompany } = useApp()

  const doc = finDocs.find((d) => d.id === id)
  if (!doc) {
    return (
      <div className="empty">
        Receipt not found.{' '}
        <a style={{ color: 'var(--navy)', fontWeight: 600 }} onClick={() => navigate('/finance/income')}>
          Back
        </a>
      </div>
    )
  }
  const company = findCompany(doc)
  const isInvest = doc.kind === 'investment'
  const headName = heads.find((h) => h.id === doc.headId)?.name || '—'
  const accName = accounts.find((a) => a.id === doc.accountId)?.name || '—'

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>
            {isInvest ? 'Investment Receipt' : 'Income Receipt'}{' '}
            <span className="mono muted" style={{ fontSize: 15 }}>{doc.docNumber}</span>
          </h1>
          <div className="mt-8">
            <span className={`badge ${isInvest ? 'badge-teal' : 'badge-green'}`}>{isInvest ? 'Investment' : 'Income'}</span>
          </div>
        </div>
        <div className="row gap-8 wrap">
          <button className="btn btn-ghost" onClick={() => navigate('/finance/income')}>
            Back
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
        </div>
      </div>

      {doc.attachments?.length > 0 && (
        <div className="card card-pad no-print" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
            Supporting Documents ({doc.attachments.length})
          </h3>
          <AttachmentList value={doc.attachments} />
        </div>
      )}

      {/* Printable receipt */}
      <div className="fin-paper">
        <div className="fin-letterhead">
          <div className="fl-logo">{company.logo ? <img src={company.logo} alt="" /> : (company.name || 'D')[0]}</div>
          <div className="fl-center">
            <div className="fl-co">{company.name}</div>
            {company.email && <div className="fl-ref">Email: {company.email}</div>}
          </div>
          <div className="voucher-badge" style={{ borderColor: GREEN, color: GREEN }}>
            {isInvest ? 'INVESTMENT' : 'INCOME'}
            <br />
            RECEIPT
          </div>
        </div>

        <div className="row between" style={{ margin: '14px 0 6px' }}>
          <div className="mono small">Ref No: {doc.docNumber}</div>
          <div className="small">Date: {formatDate(doc.date)}</div>
        </div>

        <div className="voucher-row">
          <span className="vr-label">Received with thanks from</span>
          <span className="vr-fill">{doc.party || '—'}</span>
        </div>
        <div className="voucher-row">
          <span className="vr-label">On account of</span>
          <span className="vr-fill" style={{ whiteSpace: 'pre-wrap' }}>{doc.description}</span>
        </div>
        <div className="voucher-row">
          <span className="vr-label">{isInvest ? 'Investment Head' : 'Income Head'}</span>
          <span className="vr-fill">{headName}</span>
          <span className="vr-label">Deposited To</span>
          <span className="vr-fill" style={{ maxWidth: 160 }}>{accName}</span>
        </div>

        <div className="voucher-row" style={{ marginTop: 12 }}>
          <span className="vr-label">Amount</span>
          <span style={{ border: `1px solid ${GREEN}`, borderRadius: 6, padding: '4px 14px', fontWeight: 800, minWidth: 120, textAlign: 'center' }}>
            {formatMoney(doc.amount, doc.currency)}
          </span>
          <span className="vr-label" style={{ marginLeft: 12 }}>Amount in Word</span>
          <span className="vr-fill" style={{ fontStyle: 'italic' }}>{amountInWords(Number(doc.amount) || 0, doc.currency)}</span>
        </div>

        <div className="fin-sign-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="fin-sign">
            <div style={{ height: 44 }} />
            <div className="fs-line">Received By</div>
          </div>
          <div className="fin-sign">
            <div style={{ height: 44 }} />
            <div className="fs-line">Authorized By</div>
          </div>
        </div>

        {company.address && <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 22 }}>{company.address}</div>}
      </div>
    </div>
  )
}
