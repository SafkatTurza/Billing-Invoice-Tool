import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { lineNet, MONTHS } from '../../lib/salary.js'
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
  const { findCompany } = useApp()

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

      {/* Editable payslip-only fields */}
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

        <table className="ps-table ps-salary">
          <tbody>
            <tr>
              <th style={{ background: TEAL }}>Salary</th>
              <th style={{ background: TEAL }} className="num">{cur}</th>
              <th style={{ background: TEAL }}>Final Salary</th>
              <th style={{ background: TEAL }} className="num">{cur}</th>
            </tr>
            <tr>
              <td>Monthly Salary</td>
              <td className="num">{Number(line.base).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td>{deductions[0]?.[0] || earnings[0]?.[0] || '—'}</td>
              <td className="num">{(deductions[0]?.[1] ?? earnings[0]?.[1] ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>Other (Misc.)</td>
              <td className="num">{(Number(line.otherMisc) || 0).toFixed(1)}</td>
              <td>{deductions[1]?.[0] || earnings[1]?.[0] || 'Festive Bonus'}</td>
              <td className="num">{(deductions[1]?.[1] ?? earnings[1]?.[1] ?? Number(line.festiveBonus) ?? 0).toLocaleString('en-US', { minimumFractionDigits: 1 })}</td>
            </tr>
            <tr className="ps-total-row">
              <td colSpan={2}>Total Payment</td>
              <td colSpan={2} className="num">{net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <table className="ps-table">
          <tbody>
            <tr>
              <th style={{ background: TEAL, width: '50%' }}>Final Salary</th>
              <th style={{ background: TEAL }} className="num">Amount</th>
            </tr>
            <tr className="ps-total-row">
              <td>Total Amount</td>
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
