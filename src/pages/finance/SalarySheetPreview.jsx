import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { FIN_STATUS } from '../../lib/finance.js'
import { lineNet, sheetTotals, MONTHS } from '../../lib/salary.js'
import { formatDate } from '../../lib/format.js'
import ApprovalChain from '../../components/finance/ApprovalChain.jsx'
import { AttachmentList } from '../../components/AttachmentField.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/preview.css'
import '../../styles/finance.css'

const STATUS_BADGE = {
  [FIN_STATUS.DRAFT]: 'badge-gray',
  [FIN_STATUS.PENDING]: 'badge-amber',
  [FIN_STATUS.APPROVED]: 'badge-green',
  [FIN_STATUS.REJECTED]: 'badge-red',
}

export default function SalarySheetPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { finDocs, saveFinDoc, onDocApproved } = useFinance()
  const { findCompany } = useApp()
  const toast = useToast()

  const doc = finDocs.find((d) => d.id === id)
  if (!doc) {
    return (
      <div className="empty">
        Not found.{' '}
        <a style={{ color: 'var(--navy)', fontWeight: 600 }} onClick={() => navigate('/finance/salary-sheet')}>
          Back
        </a>
      </div>
    )
  }
  const company = findCompany(doc)
  const totals = sheetTotals(doc)
  const approved = doc.status === FIN_STATUS.APPROVED

  const onSign = (newSlots, { completesApproval }) => {
    const patch = { signSlots: newSlots }
    if (completesApproval && !approved) patch.status = FIN_STATUS.APPROVED
    const saved = saveFinDoc({ ...doc, ...patch })
    if (patch.status === FIN_STATUS.APPROVED) {
      onDocApproved(saved)
      toast.success('Salary sheet approved — salary posted to the ledger.')
    }
  }

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>
            Salary Sheet <span className="mono muted" style={{ fontSize: 15 }}>{doc.docNumber}</span>
          </h1>
          <div className="mt-8">
            <span className={`badge ${STATUS_BADGE[doc.status] || 'badge-gray'}`}>{doc.status}</span>
          </div>
        </div>
        <div className="row gap-8 wrap">
          <button className="btn btn-ghost" onClick={() => navigate('/finance/salary-sheet')}>
            Back
          </button>
          {!approved && (
            <button className="btn btn-ghost" onClick={() => navigate(`/finance/salary-sheet/${doc.id}/edit`)}>
              <Icon.edit width={15} height={15} /> Edit
            </button>
          )}
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
        </div>
      </div>

      {/* Approval */}
      <div className="card card-pad no-print" style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Approval Chain</h3>
        <p className="small muted mb-16">Signed in order; management (Authorised By) signs last. On final sign the salary posts to the ledger.</p>
        <ApprovalChain type="salary-sheet" slots={doc.signSlots} onSign={onSign} readOnly={doc.status === FIN_STATUS.REJECTED} />
      </div>

      {/* Payslips (after approval) */}
      {approved && (
        <div className="card no-print" style={{ marginBottom: 18 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--navy)' }}>
            Payslips — Payroll Receipt Copies
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="text-right">Net Pay</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l) => (
                <tr key={l.id}>
                  <td className="bold">{l.name}</td>
                  <td className="text-right nowrap">{lineNet(l, doc.components).toLocaleString('en-US', { minimumFractionDigits: 2 })} {doc.currency}</td>
                  <td className="text-right">
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/finance/salary-sheet/${doc.id}/payslip/${l.id}`)}>
                      <Icon.receipt width={14} height={14} /> Open Payslip
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {doc.attachments?.length > 0 && (
        <div className="card card-pad no-print" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Attachments</h3>
          <AttachmentList value={doc.attachments} />
        </div>
      )}

      {/* Printable sheet */}
      <div className="fin-paper">
        <div className="fin-letterhead">
          <div style={{ width: 60 }} />
          <div className="fl-center">
            <div className="fl-co">{company.name}</div>
            <div className="fl-title">Employee Remuneration Requisition</div>
            <div className="fl-ref mono">Ref ID: {doc.docNumber}</div>
          </div>
          <div className="fl-logo">{company.logo ? <img src={company.logo} alt="" /> : (company.name || 'D')[0]}</div>
        </div>
        <div className="fin-date-line">
          {MONTHS[(doc.month || 1) - 1]} {doc.year}
        </div>

        <table className="fin-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>SL</th>
              <th>Name</th>
              <th className="num">Salary</th>
              {doc.components.map((c) => (
                <th key={c.id} className="num">
                  {c.label}
                </th>
              ))}
              <th className="num">Final Amount</th>
              <th style={{ width: '18%' }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={l.id}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{l.name}</td>
                <td className="num">{Number(l.base) ? Number(l.base).toLocaleString() : ''}</td>
                {doc.components.map((c) => (
                  <td key={c.id} className="num">
                    {Number(l.values?.[c.id]) ? Number(l.values[c.id]).toLocaleString() : ''}
                  </td>
                ))}
                <td className="num">{lineNet(l, doc.components).toLocaleString()}</td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{l.remarks}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ textAlign: 'center' }}>Total Remuneration ({doc.currency})</td>
              <td className="num">{totals.base.toLocaleString()}</td>
              {doc.components.map((c) => (
                <td key={c.id} className="num">
                  {(totals.compTotals[c.id] || 0).toLocaleString()}
                </td>
              ))}
              <td className="num">{totals.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div className="fin-sign-row" style={{ gridTemplateColumns: `repeat(${doc.signSlots.length}, 1fr)` }}>
          {doc.signSlots.map((s, i) => (
            <div key={i} className="fin-sign">
              {s.signed && s.signatureImg ? <img src={s.signatureImg} alt="" className="fs-img" /> : <div style={{ height: 44 }} />}
              <div className="fs-line">{s.label}</div>
              {s.signed && <div className="fs-date">{formatDate(s.date)}</div>}
            </div>
          ))}
        </div>
        {company.address && <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 20 }}>{company.address}</div>}
      </div>
    </div>
  )
}
