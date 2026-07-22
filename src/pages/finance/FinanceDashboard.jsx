import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { FIN_STATUS, isExpenseTxn, billDue, billOverdue, txnBase } from '../../lib/finance.js'
import { can } from '../../lib/roles.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/dashboard.css'

function ym(dateStr) {
  return (dateStr || '').slice(0, 7)
}
function sumByCurrency(list, pick) {
  const out = {}
  for (const d of list) {
    const v = Number(pick(d)) || 0
    out[d.currency] = (out[d.currency] || 0) + v
  }
  return out
}
function CurLines({ map, cls }) {
  const e = Object.entries(map)
  if (!e.length) return <span className="muted">—</span>
  return e.map(([c, v]) => (
    <div key={c} className={cls}>
      {formatMoney(v, c)}
    </div>
  ))
}

export default function FinanceDashboard() {
  const { ledger, finDocs, heads, accounts } = useFinance()
  const { docs, currentUser } = useApp()
  const navigate = useNavigate()
  const canManage = can(currentUser.role, 'financeManage')
  const thisMonth = ym(new Date().toISOString())

  // Approved-only expenses → posted ledger 'out' this month.
  const monthOut = useMemo(
    () => ledger.filter((t) => isExpenseTxn(t) && ym(t.txnDate) === thisMonth),
    [ledger, thisMonth],
  )
  const approvedExpense = sumByCurrency(monthOut, (t) => t.amount)
  // Consolidated BDT base — combines every currency's spend into one figure.
  const approvedExpenseBase = monthOut.reduce((s, t) => s + txnBase(t), 0)
  const multiCurrencyOut = Object.keys(approvedExpense).length > 1

  // Pending (not yet approved) — shown separately, NOT in the main figures.
  const pending = useMemo(
    () => finDocs.filter((d) => !d.deleted && d.status === FIN_STATUS.PENDING),
    [finDocs],
  )
  const pendingAmt = sumByCurrency(pending, (d) => d.amount || d.total)

  // Billing income from the existing system (paid invoices).
  const paidInvoices = useMemo(() => docs.filter((d) => d.type === 'invoices' && !d.deleted && d.status === 'Paid'), [docs])
  const income = sumByCurrency(paidInvoices, (d) => d.grandTotal)

  // Outstanding payables (unpaid portion of bills) — money the company owes.
  const openBills = useMemo(
    () => finDocs.filter((d) => d.type === 'bill' && !d.deleted && d.status !== FIN_STATUS.REVERSED && billDue(d) > 0),
    [finDocs],
  )
  const payables = sumByCurrency(openBills, (d) => billDue(d))
  const overdueCount = useMemo(() => openBills.filter((d) => billOverdue(d)).length, [openBills])

  // Cash position across accounts.
  const balances = useMemo(() => {
    return accounts.map((a) => {
      let bal = Number(a.openingBalance) || 0
      for (const t of ledger) {
        if (t.status !== 'posted' || t.accountId !== a.id) continue
        bal += t.direction === 'in' ? Number(t.amount) || 0 : -(Number(t.amount) || 0)
      }
      return { ...a, balance: bal }
    })
  }, [accounts, ledger])

  // Expense-by-head this month (approved only).
  const byHead = useMemo(() => {
    const m = {}
    for (const t of monthOut) {
      const name = heads.find((h) => h.id === t.headId)?.name || 'Uncategorised'
      m[name] = (m[name] || 0) + txnBase(t)
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [monthOut, heads])

  const recent = useMemo(
    () => [...ledger].filter((t) => t.status === 'posted').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8),
    [ledger],
  )

  return (
    <div>
      <h1 className="page-title">Finance Dashboard</h1>
      <p className="page-sub">Approved expenses vs. earnings for {formatDate(thisMonth + '-01').replace(/^\d+ /, '')}. Only approved items count here.</p>

      <div className="fin-kpis mt-24">
        <div className="fin-kpi">
          <div className="k-label">Billing Income (Paid)</div>
          <div className="k-val in">
            <CurLines map={income} cls="in" />
          </div>
          <div className="k-sub">{paidInvoices.length} paid invoices</div>
        </div>
        <div className="fin-kpi">
          <div className="k-label">Approved Expense (this month)</div>
          <div className="k-val out">
            <CurLines map={approvedExpense} cls="out" />
          </div>
          {multiCurrencyOut && approvedExpenseBase > 0 && (
            <div className="k-sub">≈ {formatMoney(approvedExpenseBase, 'BDT')} consolidated</div>
          )}
          <div className="k-sub">{monthOut.length} transactions</div>
        </div>
        <div className="fin-kpi" style={{ cursor: 'pointer' }} onClick={() => navigate('/finance/reports')}>
          <div className="k-label">Pending Approval</div>
          <div className="k-val" style={{ color: 'var(--amber)' }}>
            <CurLines map={pendingAmt} cls="" />
          </div>
          <div className="k-sub">{pending.length} awaiting sign-off — not counted yet</div>
        </div>
        <div className="fin-kpi" style={{ cursor: 'pointer' }} onClick={() => navigate('/finance/bills')}>
          <div className="k-label">Outstanding Payables</div>
          <div className="k-val out">
            <CurLines map={payables} cls="out" />
          </div>
          <div className="k-sub">
            {openBills.length} open bill{openBills.length === 1 ? '' : 's'}
            {overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
          </div>
        </div>
        <div className="fin-kpi">
          <div className="k-label">Cash & Bank</div>
          <div className="k-val" style={{ color: 'var(--brand-blue-600)', fontSize: 18 }}>
            {balances.length === 0 ? (
              <span className="muted">—</span>
            ) : (
              balances.map((b) => (
                <div key={b.id} style={{ fontSize: 15 }}>
                  {b.name}: {b.balance.toLocaleString('en-US', { minimumFractionDigits: 0 })} {b.currency}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {canManage && (
        <>
          <div className="section-head">
            <h3>Quick Create</h3>
          </div>
          <div className="quick-create">
            {[
              { to: '/finance/requisition/new', label: 'New Requisition', icon: Icon.invoice },
              { to: '/finance/voucher/new', label: 'New Voucher', icon: Icon.money },
              { to: '/finance/expenses', label: 'Daily Expense', icon: Icon.po },
              { to: '/finance/bills', label: 'New Bill', icon: Icon.receipt },
              { to: '/finance/income', label: 'Income / Investment', icon: Icon.money },
            ].map((q) => (
              <button key={q.label} className="qc-btn" onClick={() => navigate(q.to)}>
                <span className="qc-icon">
                  <q.icon width={18} height={18} />
                </span>
                {q.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="grid grid-2 mt-24" style={{ alignItems: 'start' }}>
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', fontWeight: 700, color: 'var(--brand-dark)' }}>
            Expense by Head (this month, BDT)
          </div>
          {byHead.length === 0 ? (
            <div className="empty">No approved expenses this month.</div>
          ) : (
            <div className="table-scroll"><table className="table">
              <tbody>
                {byHead.map(([name, amt]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="text-right nowrap ledger-out">{amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', fontWeight: 700, color: 'var(--brand-dark)' }}>
            Recent Transactions
          </div>
          {recent.length === 0 ? (
            <div className="empty">No transactions yet.</div>
          ) : (
            <div className="table-scroll"><table className="table">
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td className="small nowrap">{formatDate(t.txnDate || t.createdAt)}</td>
                    <td className="small">{t.description || t.docNumber}</td>
                    <td className={`text-right nowrap ${t.direction === 'in' ? 'ledger-in' : 'ledger-out'}`}>
                      {t.direction === 'in' ? '+' : '−'} {formatMoney(t.amount, t.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  )
}
