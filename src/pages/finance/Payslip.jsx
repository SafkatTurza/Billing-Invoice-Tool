import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import PayslipPaper from '../../components/finance/PayslipPaper.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/preview.css'
import '../../styles/finance.css'
import '../../styles/payslip.css'

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
        <a style={{ color: 'var(--brand-dark)', fontWeight: 600 }} onClick={() => navigate(`/finance/salary-sheet/${id}`)}>
          Back
        </a>
      </div>
    )
  }
  const company = findCompany(doc)
  const emp = employees.find((e) => e.empId === line.empId || e.id === line.employeeId)
  const payslipRef = `${doc.docNumber}-P${doc.lines.indexOf(line) + 1}`

  const updLine = (changes) => {
    const lines = doc.lines.map((l) => (l.id === lineId ? { ...l, ...changes } : l))
    saveFinDoc({ ...doc, lines })
  }

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

      <PayslipPaper doc={doc} line={line} company={company} emp={emp} finDocs={finDocs} />
    </div>
  )
}
