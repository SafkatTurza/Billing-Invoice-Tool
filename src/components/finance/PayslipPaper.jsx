import { lineComputed, ytdForEmployee, MONTHS } from '../../lib/salary.js'
import { formatMoney, formatDate } from '../../lib/format.js'

const TEAL = '#0d9488'

// The printable "Payroll Receipt Copy" for one salary-sheet line. Shared by the
// single Payslip view and the Bulk Payslips print sheet so both stay identical.
export default function PayslipPaper({ doc, line, company, emp, finDocs }) {
  const net = lineComputed(line, doc).net
  const comp = lineComputed(line, doc)
  const cur = line.currency || doc.currency
  const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })
  const ytd = ytdForEmployee(finDocs, emp || { id: line.employeeId, empId: line.empId }, doc.year)

  const earnings = doc.components.filter((c) => c.type === 'earning').map((c) => [c.label, Number(line.values?.[c.id]) || 0])
  const deductions = doc.components.filter((c) => c.type === 'deduction').map((c) => [c.label, Number(line.values?.[c.id]) || 0])
  const payslipRef = `${doc.docNumber}-P${doc.lines.indexOf(line) + 1}`

  return (
    <div className="payslip-paper">
      <h1 className="ps-title">Payroll Receipt Copy</h1>
      <div className="ps-refline">
        <div><b>Ref.ID :</b> <span className="mono">{payslipRef}</span></div>
        <div><b>Payment Date :</b> {line.paymentDate ? formatDate(line.paymentDate) : '—'}</div>
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
          {comp.overtimeAmount > 0 && (
            <tr>
              <td>Overtime ({Number(line.overtimeHours) || 0} hr) <span style={{ color: TEAL, fontWeight: 700 }}>(+)</span></td>
              <td className="num">{fmt(comp.overtimeAmount)}</td>
            </tr>
          )}
          {deductions.map(([label, val]) => (
            <tr key={'d-' + label}>
              <td>{label} <span style={{ color: '#dc2626', fontWeight: 700 }}>(−)</span></td>
              <td className="num">{val ? '−' : ''}{fmt(val)}</td>
            </tr>
          ))}
          {comp.unpaidDeduction > 0 && (
            <tr>
              <td>Unpaid Leave ({comp.unpaidDays} day) <span style={{ color: '#dc2626', fontWeight: 700 }}>(−)</span></td>
              <td className="num">−{fmt(comp.unpaidDeduction)}</td>
            </tr>
          )}
          {comp.loanDeduction > 0 && (
            <tr>
              <td>Loan / Advance Repayment <span style={{ color: '#dc2626', fontWeight: 700 }}>(−)</span></td>
              <td className="num">−{fmt(comp.loanDeduction)}</td>
            </tr>
          )}
          <tr className="ps-total-row">
            <td>Total Payment (Final Salary)</td>
            <td className="num">{formatMoney(net, cur)}</td>
          </tr>
        </tbody>
      </table>

      {ytd.totals.months > 1 && (
        <table className="ps-table">
          <tbody>
            <tr>
              <th style={{ background: TEAL }} colSpan={2}>Year to Date ({doc.year}) — {ytd.totals.months} month(s)</th>
            </tr>
            <tr>
              <td>Gross Earnings YTD</td>
              <td className="num">{fmt(ytd.totals.gross)} {cur}</td>
            </tr>
            <tr>
              <td>Total Deductions YTD</td>
              <td className="num">{fmt(ytd.totals.deductions + ytd.totals.loan)} {cur}</td>
            </tr>
            <tr className="ps-total-row">
              <td>Net Paid YTD</td>
              <td className="num">{fmt(ytd.totals.net)} {cur}</td>
            </tr>
          </tbody>
        </table>
      )}

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
        <div className="ps-sign"><div className="ps-sign-line">Authorized By</div></div>
        <div className="ps-sign"><div className="ps-sign-line">Received By</div></div>
      </div>

      <div className="ps-footer">
        {company.name}
        {company.address ? ` | ${company.address}` : ''}
        {company.phone ? ` | ${company.phone}` : ''}
        {company.email ? ` | ${company.email}` : ''}
      </div>
    </div>
  )
}
