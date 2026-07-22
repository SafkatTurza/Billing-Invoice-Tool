import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { employeeSalaryHistory, ytdForEmployee, lineComputed } from '../../lib/salary.js'
import { formatMoney, formatDate, todayISO } from '../../lib/format.js'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/preview.css'
import '../../styles/finance.css'

// Human-readable tenure between a join date and today.
function tenure(joinDate) {
  if (!joinDate) return ''
  const start = new Date(joinDate)
  const now = new Date()
  if (isNaN(start) || start > now) return ''
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y ? `${y} year${y > 1 ? 's' : ''}` : '', m ? `${m} month${m > 1 ? 's' : ''}` : ''].filter(Boolean).join(' ') || 'less than a month'
}

// Employment / salary certificate for one employee — states designation,
// tenure and the current salary breakdown drawn from the latest approved sheet.
export default function SalaryCertificate() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employees, finDocs } = useFinance()
  const { company: activeCompany, findCompany } = useApp()

  const emp = employees.find((e) => e.id === id)
  const year = new Date().getFullYear()
  const [purpose, setPurpose] = useState('')

  if (!emp) {
    return (
      <div className="empty">
        Employee not found.{' '}
        <a style={{ color: 'var(--navy)', fontWeight: 600 }} onClick={() => navigate('/finance/employees')}>Back</a>
      </div>
    )
  }

  const history = employeeSalaryHistory(finDocs, emp, year)
  const latest = history[history.length - 1] // most recent approved month this year
  const ytd = ytdForEmployee(finDocs, emp, year)
  const company = latest ? findCompany(latest.doc) : activeCompany
  const cur = latest?.line.currency || emp.currency || 'BDT'

  // Salary breakdown: prefer the latest approved sheet line; fall back to the
  // employee's base salary if there are no approved sheets yet.
  const breakdown = []
  if (latest) {
    const c = lineComputed(latest.line, latest.doc)
    breakdown.push(['Basic Salary', c.base])
    for (const comp of latest.doc.components) {
      const v = Number(latest.line.values?.[comp.id]) || 0
      if (v) breakdown.push([`${comp.label} (${comp.type === 'deduction' ? '−' : '+'})`, comp.type === 'deduction' ? -v : v])
    }
    if (c.overtimeAmount) breakdown.push(['Overtime', c.overtimeAmount])
  } else {
    breakdown.push(['Basic Salary', Number(emp.baseSalary) || 0])
  }
  const grossMonthly = latest ? lineComputed(latest.line, latest.doc).net : Number(emp.baseSalary) || 0

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>Salary Certificate</h1>
          <p className="page-sub mono">{emp.name} · {emp.empId}</p>
        </div>
        <div className="row gap-8 wrap">
          <button className="btn btn-ghost" onClick={() => navigate('/finance/employees')}>Back</button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
        </div>
      </div>

      <div className="card card-pad no-print" style={{ marginBottom: 18, maxWidth: 560 }}>
        <div className="field">
          <label>Purpose / addressed to (optional)</label>
          <input className="input" placeholder="e.g. To whom it may concern / Bank loan application" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>
      </div>

      <div className="fin-paper">
        <div className="fin-letterhead">
          <div style={{ width: 60 }} />
          <div className="fl-center">
            <div className="fl-co">{company?.name}</div>
            <div className="fl-title">Salary Certificate</div>
          </div>
          <div className="fl-logo">{company?.logo ? <img src={company.logo} alt="" /> : (company?.name || 'D')[0]}</div>
        </div>
        <div className="fin-date-line">Date: {formatDate(todayISO())}</div>

        {purpose && <p style={{ fontWeight: 700, marginBottom: 14 }}>{purpose}</p>}

        <p style={{ lineHeight: 1.9, marginBottom: 16 }}>
          This is to certify that <b>{emp.name}</b> (Employee ID: <span className="mono">{emp.empId}</span>) has been employed with{' '}
          <b>{company?.name}</b> as <b>{emp.designation || 'a member of staff'}</b>
          {emp.department ? ` in the ${emp.department} department` : ''}
          {emp.joinDate ? <> since <b>{formatDate(emp.joinDate)}</b>{tenure(emp.joinDate) ? ` (${tenure(emp.joinDate)})` : ''}</> : ''}.
          {' '}The employee currently draws a monthly net remuneration of <b>{formatMoney(grossMonthly, cur)}</b>, detailed below.
        </p>

        <div className="table-scroll"><table className="fin-table" style={{ maxWidth: 420 }}>
          <thead>
            <tr>
              <th>Component</th>
              <th className="num">Amount ({cur})</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map(([label, amt], i) => (
              <tr key={i}>
                <td>{label}</td>
                <td className="num">{Number(amt).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Net Monthly Salary</td>
              <td className="num">{formatMoney(grossMonthly, cur)}</td>
            </tr>
          </tfoot>
        </table></div>

        {ytd.totals.months > 0 && (
          <p style={{ marginTop: 14 }}>
            Total net salary paid in {year} to date: <b>{formatMoney(ytd.totals.net, cur)}</b> across {ytd.totals.months} month(s).
          </p>
        )}

        <p style={{ marginTop: 16, lineHeight: 1.9 }}>
          This certificate is issued upon the employee's request and does not constitute a contract of employment.
        </p>

        <div className="fin-sign-row" style={{ gridTemplateColumns: '1fr', maxWidth: 260, marginLeft: 'auto' }}>
          <div className="fin-sign"><div style={{ height: 44 }} /><div className="fs-line">Authorised Signatory</div></div>
        </div>
        {company?.address && <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 20 }}>{company.address}</div>}
      </div>
    </div>
  )
}
