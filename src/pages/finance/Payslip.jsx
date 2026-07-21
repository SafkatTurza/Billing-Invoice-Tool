import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { lineNet, MONTHS } from '../../lib/salary.js'
import { can } from '../../lib/roles.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/preview.css'
import '../../styles/finance.css'
import '../../styles/payslip.css'

const TEAL = '#0d9488'

// Payroll Receipt Copy — derived from an approved salary-sheet line.
// Editable payslip-only fields (payment date, messages, remarks) are stored
// back onto the sheet line so the payslip stays fully reproducible.
export default function Payslip() {
  const { id, lineId } = useParams()
  const navigate = useNavigate()
  const { finDocs, saveFinDoc, employees } = useFinance()
  const { findCompany, currentUser } = useApp()
  const canManage = can(currentUser.role, 'financeManage')

  const doc = finDocs.find((d) => d.id === id)
  const line = doc?.lines.find((l) => l.id === lineId)
  if (!doc || !line) {
    return (
      <div className="empty">
        Payslip not found.{' '}
        <a style={{ color: 'var(--navy)', fontWeight: 600 }} onClick={() => navigate(`/finance/salary-sheet/${id}`)}>
          Back
        </a>
      </div>
    )
  }
  const company = findCompany(doc)
  const emp = employees.find((e) => e.empId === line.empId || e.id === line.employeeId)
  const net = lineNet(line, doc.components)
  const cur = line.currency || doc.currency
  const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })

  const updLine = (changes) => {
    const lines = doc.lines.map((l) => (l.id === lineId ? { ...l, ...changes } : l))
    saveFinDoc({ ...doc, lines })
  }

  // Earnings and deductions from the sheet's components for this line.
  const earnings = doc.components.filter((c) => c.type === 'earning').map((c) => [c.label, Number(line.values?.[c.id]) || 0])
  const deductions = doc.components.filter((c) => c.type === 'deduction').map((c) => [c.label, Number(line.values?.[c.id]) || 0])

  // Payslip ref e.g. DCS-SAL-2607-<line index>
  const payslipRef = `${doc.docNumber}-P${doc.lines.indexOf(line) + 1}`

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>
            Payslip — {line.name}
          </h1>
          <p className="page-sub mono">{payslipRef}</p>
        </div>
        <div className="row gap-8 wrap">
          <button className="btn btn-ghost" onClick={() => navigate(`/finance/salary-sheet/${id}`)}>
            Back
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
        </div>
      </div>

      {/* Editable payslip-only fields (Accounts / Super Admin only) */}
      {canManage && (
      <div className="card card-pad no-print" style={{ marginBottom: 18, maxWidth: 560 }}>
        <div className="grid grid-3">
          <div className="field">
            <label>Payment Date</label>
            <input type="date" className="input" value={line.paymentDate || ''} onChange={(e) => updLine({ paymentDate: e.target.value })} />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Message (fixed note)</label>
            <input className="input" value={line.message || ''} onChange={(e) => updLine({ message: e.target.value })} />
          </div>
          <div className="field" style={{ gridColumn: 'span 3' }}>
            <label>Remarks (this month)</label>
            <input className="input" value={line.payslipRemarks || ''} onChange={(e) => updLine({ payslipRemarks: e.target.value })} />
          </div>
        </div>
      </div>
      )}

      {/* Printable payslip */}
      <div className="payslip-paper">
        <h1 className="ps-title">Payroll Receipt Copy</h1>
        <div className="ps-refline">
          <div>
            <b>Ref.ID :</b> <span className="mono">{payslipRef}</span>
          </div>
          <div>
            <b>Payment Date :</b> {line.paymentDate ? formatDate(line.paymentDate) : '—'}
          </div>
        </div>

        <table className="ps-table">
          <tbody>
            <tr>
              <th style={{ background: TEAL }}>Employee Name</th>
              <td>{line.name}</td>
              <th style={{ background: TEAL }}>Year</th>
              <th style={{ background: TEAL }}>Month of Payslip</th>
            </tr>
            <tr>
              <th style={{ background: TEAL }}>Employee ID</th>
              <td>{emp?.empId || line.empId || 'N/A'}</td>
              <td style={{ textAlign: 'center' }}>{doc.year}</td>
              <td style={{ textAlign: 'center' }}>{MONTHS[(doc.month || 1) - 1]}</td>
            </tr>
          </tbody>
        </table>

        {/* Itemised breakdown — every earning (+) and deduction (−) from the
            sheet's components, so the figures always reconcile to Total Payment
            regardless of how many components the sheet has. */}
        <table className="ps-table ps-salary">
          <tbody>
            <tr>
              <th style={{ background: TEAL }}>Description</th>
              <th style={{ background: TEAL }} className="num">Amount ({cur})</th>
            </tr>
            <tr>
              <td>Monthly Salary</td>
              <td className="num">{fmt(Number(line.base) || 0)}</td>
            </tr>
            {earnings.map(([label, val]) => (
              <tr key={'e-' + label}>
                <td>{label} <span style={{ color: TEAL, fontWeight: 700 }}>(+)</span></td>
                <td className="num">{fmt(val)}</td>
              </tr>
            ))}
            {deductions.map(([label, val]) => (
              <tr key={'d-' + label}>
                <td>{label} <span style={{ color: '#dc2626', fontWeight: 700 }}>(−)</span></td>
                <td className="num">{val ? '−' : ''}{fmt(val)}</td>
              </tr>
            ))}
            <tr className="ps-total-row">
              <td>Total Payment (Final Salary)</td>
              <td className="num">{formatMoney(net, cur)}</td>
            </tr>
          </tbody>
        </table>

        <table className="ps-table">
          <tbody>
            <tr>
              <th style={{ width: 180, verticalAlign: 'middle' }}>Messages</th>
              <td style={{ textAlign: 'center', fontWeight: 700, padding: '18px' }}>
                {line.message || '** As per Company Policy'}
                {line.payslipRemarks && <div style={{ fontWeight: 400, fontSize: 12, color: '#64748b', marginTop: 6 }}>{line.payslipRemarks}</div>}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="ps-sign-row">
          <div className="ps-sign">
            <div className="ps-sign-line">Authorized By</div>
          </div>
          <div className="ps-sign">
            <div className="ps-sign-line">Received By</div>
          </div>
        </div>

        <div className="ps-footer">
          {company.name}
          {company.address ? ` | ${company.address}` : ''}
          {company.phone ? ` | ${company.phone}` : ''}
          {company.email ? ` | ${company.email}` : ''}
        </div>
      </div>
    </div>
  )
}
