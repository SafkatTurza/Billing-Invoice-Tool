import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { FIN_STATUS } from '../../lib/finance.js'
import { MONTHS } from '../../lib/salary.js'
import PayslipPaper from '../../components/finance/PayslipPaper.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/preview.css'
import '../../styles/finance.css'
import '../../styles/payslip.css'

// Every payslip for one salary sheet, stacked one-per-page for a single print
// run — so Accounts can produce the whole month's payslips in one PDF.
export default function BulkPayslips() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { finDocs, employees } = useFinance()
  const { findCompany } = useApp()

  const doc = finDocs.find((d) => d.id === id)
  if (!doc) {
    return (
      <div className="empty">
        Not found.{' '}
        <a style={{ color: 'var(--navy)', fontWeight: 600 }} onClick={() => navigate('/finance/salary-sheet')}>Back</a>
      </div>
    )
  }
  const company = findCompany(doc)
  const approved = doc.status === FIN_STATUS.APPROVED

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>Bulk Payslips — {MONTHS[(doc.month || 1) - 1]} {doc.year}</h1>
          <p className="page-sub mono">{doc.docNumber} · {doc.lines.length} payslip(s)</p>
        </div>
        <div className="row gap-8 wrap">
          <button className="btn btn-ghost" onClick={() => navigate(`/finance/salary-sheet/${doc.id}`)}>Back</button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print all / PDF
          </button>
        </div>
      </div>

      {!approved && (
        <div className="warn-banner no-print" style={{ marginBottom: 16 }}>
          This sheet is <b>{doc.status}</b> — payslips are provisional until it is approved.
        </div>
      )}

      <div className="bulk-payslips">
        {doc.lines.map((line) => {
          const emp = employees.find((e) => e.empId === line.empId || e.id === line.employeeId)
          return (
            <div key={line.id} className="bulk-payslip-page">
              <PayslipPaper doc={doc} line={line} company={company} emp={emp} finDocs={finDocs} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
