import { useState, useMemo } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { FIN_STATUS, isExpenseTxn } from '../../lib/finance.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/preview.css'
import '../../styles/finance.css'

function ymNow() {
  return new Date().toISOString().slice(0, 7)
}

// Monthly Expenditure — "Summary of Actual Expense" (the AES report).
// Lists APPROVED expenses for the month; pending items are shown separately
// and are NOT counted in the total (management sees only approved figures).
export default function MonthlyReport() {
  const { ledger, finDocs, heads, accounts } = useFinance()
  const { company } = useApp()
  const toast = useToast()
  const [month, setMonth] = useState(ymNow())

  const headName = (id) => heads.find((h) => h.id === id)?.name || '—'
  const accName = (id) => accounts.find((a) => a.id === id)?.name || '—'

  const approved = useMemo(
    () =>
      ledger
        .filter((t) => isExpenseTxn(t) && (t.txnDate || '').slice(0, 7) === month)
        .sort((a, b) => new Date(a.txnDate) - new Date(b.txnDate)),
    [ledger, month],
  )
  const pending = useMemo(
    () => finDocs.filter((d) => !d.deleted && d.status === FIN_STATUS.PENDING && (d.date || '').slice(0, 7) === month),
    [finDocs, month],
  )

  const totalByCur = useMemo(() => {
    const m = {}
    for (const t of approved) m[t.currency] = (m[t.currency] || 0) + (Number(t.amount) || 0)
    return m
  }, [approved])

  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const rows = [['SL', 'Date', 'Expense Head', 'Particulars', 'Reference', 'Account', 'Amount', 'Currency']]
      approved.forEach((t, i) =>
        rows.push([i + 1, formatDate(t.txnDate), headName(t.headId), t.description, t.docNumber || '', accName(t.accountId), Number(t.amount) || 0, t.currency]),
      )
      rows.push([])
      Object.entries(totalByCur).forEach(([c, v]) => rows.push(['', '', '', 'TOTAL', '', '', v, c]))
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 22 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 8 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Actual Expense')
      XLSX.writeFile(wb, `Monthly_Expenditure_${month}.xlsx`)
    } catch (e) {
      toast.error('Export failed.')
    }
  }

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title">Monthly Expenditure Report</h1>
          <p className="page-sub">Summary of actual (approved) expenses. Pending items are listed separately.</p>
        </div>
        <div className="row gap-8 center wrap">
          <input type="month" className="input" style={{ width: 170 }} value={month} onChange={(e) => setMonth(e.target.value)} />
          <button className="btn btn-ghost" onClick={exportExcel}>
            <Icon.download width={15} height={15} /> Excel
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
        </div>
      </div>

      <div className="fin-paper">
        <div className="fin-letterhead">
          <div style={{ width: 60 }} />
          <div className="fl-center">
            <div className="fl-co">{company.name}</div>
            <div className="fl-title">Summary of Actual Expense — {formatDate(month + '-01').replace(/^\d+ /, '')}</div>
          </div>
          <div className="fl-logo">{company.logo ? <img src={company.logo} alt="" /> : (company.name || 'D')[0]}</div>
        </div>

        {approved.length === 0 ? (
          <div className="empty">No approved expenses for this month.</div>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th style={{ width: 34 }}>SL</th>
                <th style={{ width: 80 }}>Date</th>
                <th style={{ width: '20%' }}>Expense Head</th>
                <th>Particulars</th>
                <th style={{ width: 120 }}>Reference</th>
                <th className="num" style={{ width: 100 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((t, i) => (
                <tr key={t.id}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td>{formatDate(t.txnDate)}</td>
                  <td>{headName(t.headId)}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{t.description}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{t.docNumber || '—'}</td>
                  <td className="num">{formatMoney(t.amount, t.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {Object.entries(totalByCur).map(([c, v]) => (
                <tr key={c}>
                  <td colSpan={5} style={{ textAlign: 'right' }}>Total ({c})</td>
                  <td className="num">{formatMoney(v, c)}</td>
                </tr>
              ))}
            </tfoot>
          </table>
        )}
      </div>

      {/* Pending — separate, not part of the approved total */}
      <div className="card mt-24 no-print">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, color: 'var(--navy)' }}>Pending Approval</span>
          <span className="badge badge-amber">{pending.length}</span>
          <span className="small muted">not counted in the report above until approved</span>
        </div>
        {pending.length === 0 ? (
          <div className="empty">Nothing awaiting approval this month.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Details</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((d) => (
                <tr key={d.id}>
                  <td className="mono small">{d.docNumber}</td>
                  <td className="small">{d.type.replace('-', ' ')}</td>
                  <td>{d.title || d.purpose || '—'}</td>
                  <td className="text-right nowrap" style={{ color: 'var(--amber)', fontWeight: 700 }}>
                    {formatMoney(d.amount || d.total, d.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
