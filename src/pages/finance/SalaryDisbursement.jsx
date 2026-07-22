import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { FIN_STATUS } from '../../lib/finance.js'
import { lineComputed, sheetTotals, MONTHS } from '../../lib/salary.js'
import { formatMoney, formatDate, todayISO } from '../../lib/format.js'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/preview.css'
import '../../styles/finance.css'

// Auto-generated salary disbursement voucher — derived from an approved salary
// sheet. The sheet's approval already posts the salary expense to the ledger;
// this voucher is the payout record (one payee line per employee), so it never
// re-posts. Print/PDF gives a formal disbursement document.
export default function SalaryDisbursement() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { finDocs, employees } = useFinance()
  const { findCompany } = useApp()

  const doc = finDocs.find((d) => d.id === id)
  if (!doc) {
    return (
      <div className="empty">
        Not found.{' '}
        <a style={{ color: 'var(--brand-dark)', fontWeight: 600 }} onClick={() => navigate('/finance/salary-sheet')}>Back</a>
      </div>
    )
  }
  const company = findCompany(doc)
  const totals = sheetTotals(doc)
  const approved = doc.status === FIN_STATUS.APPROVED
  const voucherNo = `${doc.docNumber}-DV`

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>Salary Disbursement Voucher</h1>
          <p className="page-sub mono">{voucherNo}</p>
        </div>
        <div className="row gap-8 wrap">
          <button className="btn btn-ghost" onClick={() => navigate(`/finance/salary-sheet/${doc.id}`)}>Back</button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
        </div>
      </div>

      {!approved && (
        <div className="warn-banner no-print" style={{ marginBottom: 16 }}>
          This salary sheet is <b>{doc.status}</b> — the disbursement voucher is provisional until the sheet is approved.
        </div>
      )}

      <div className="fin-paper">
        <div className="fin-letterhead">
          <div style={{ width: 60 }} />
          <div className="fl-center">
            <div className="fl-co">{company.name}</div>
            <div className="fl-title">Salary Disbursement Voucher</div>
            <div className="fl-ref mono">Ref ID: {voucherNo}</div>
          </div>
          <div className="fl-logo">{company.logo ? <img src={company.logo} alt="" /> : (company.name || 'D')[0]}</div>
        </div>
        <div className="fin-date-line">Date: {formatDate(doc.date || todayISO())}</div>

        <div className="voucher-row"><span className="vr-label">Being paid for:</span><span className="vr-fill">Staff salary — {MONTHS[(doc.month || 1) - 1]} {doc.year}</span></div>
        <div className="voucher-row"><span className="vr-label">Against sheet:</span><span className="vr-fill mono">{doc.docNumber}</span></div>
        <div className="voucher-row"><span className="vr-label">Payment method:</span><span className="vr-fill">Bank Transfer</span></div>

        <div className="table-scroll"><table className="fin-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>SL</th>
              <th>Employee</th>
              <th>ID</th>
              <th>Designation</th>
              <th className="num">Net Payable ({doc.currency})</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => {
              const emp = employees.find((e) => e.id === l.employeeId || e.empId === l.empId)
              return (
                <tr key={l.id}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td>{l.name}</td>
                  <td className="mono">{emp?.empId || l.empId || '—'}</td>
                  <td>{emp?.designation || '—'}</td>
                  <td className="num">{lineComputed(l, doc).net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right' }}>Total Disbursement ({doc.currency})</td>
              <td className="num">{formatMoney(totals.net, doc.currency)}</td>
            </tr>
          </tfoot>
        </table></div>

        <div className="fin-sign-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="fin-sign"><div style={{ height: 44 }} /><div className="fs-line">Prepared By</div></div>
          <div className="fin-sign"><div style={{ height: 44 }} /><div className="fs-line">Checked By</div></div>
          <div className="fin-sign"><div style={{ height: 44 }} /><div className="fs-line">Authorised By</div></div>
        </div>
        {company.address && <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 20 }}>{company.address}</div>}
      </div>
    </div>
  )
}
