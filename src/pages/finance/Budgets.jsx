import { useState, useMemo } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { isExpenseTxn, txnBase } from '../../lib/finance.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { useToast } from '../../components/Toast.jsx'

// Phase E — Budgets per head. A monthly spending cap per expense head, compared
// against this month's *actual* posted expenses (approved vouchers, recorded
// expenses, bill payments — anything that hit the ledger as money out).
export default function Budgets() {
  const { heads, ledger, budgets, saveBudget, deleteBudget } = useFinance()
  const { currentUser } = useApp()
  const toast = useToast()
  const canManage = can(currentUser.role, 'financeManage')
  const [drafts, setDrafts] = useState({}) // headId -> in-progress input value

  const thisMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const expenseHeads = heads.filter((h) => h.kind === 'expense')

  // Actual spend this month per head, from the posted ledger (out only, no transfers).
  const actualByHead = useMemo(() => {
    const m = {}
    for (const t of ledger) {
      if (!isExpenseTxn(t)) continue
      if ((t.txnDate || '').slice(0, 7) !== thisMonth) continue
      if (!t.headId) continue
      // Consolidate in the BDT base so foreign-currency spend counts correctly.
      m[t.headId] = (m[t.headId] || 0) + txnBase(t)
    }
    return m
  }, [ledger, thisMonth])

  const budgetFor = (headId) => budgets.find((b) => b.headId === headId)

  const rows = useMemo(
    () =>
      expenseHeads.map((h) => {
        const b = budgetFor(h.id)
        const budget = Number(b?.amount) || 0
        const actual = actualByHead[h.id] || 0
        const pct = budget > 0 ? Math.round((actual / budget) * 100) : null
        return { head: h, currency: b?.currency || 'BDT', budget, actual, remaining: budget - actual, pct }
      }),
    [expenseHeads, budgets, actualByHead],
  )

  const totals = useMemo(() => {
    let budget = 0
    let actual = 0
    for (const r of rows) {
      budget += r.budget
      actual += r.actual
    }
    return { budget, actual, remaining: budget - actual }
  }, [rows])

  const commit = (headId, currency) => {
    const raw = drafts[headId]
    if (raw === undefined) return
    const val = Number(raw) || 0
    if (val <= 0) deleteBudget(headId)
    else saveBudget(headId, val, currency)
    setDrafts((d) => {
      const c = { ...d }
      delete c[headId]
      return c
    })
    toast.success('Budget saved.')
  }

  const barColor = (pct) => (pct == null ? 'var(--border)' : pct > 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)')

  return (
    <div>
      <h1 className="page-title">Budgets</h1>
      <p className="page-sub">
        Monthly spending cap per expense head, tracked against actual posted expenses for{' '}
        {formatDate(thisMonth + '-01').replace(/^\d+ /, '')}.
      </p>

      <div className="card mt-24">
        <table className="table">
          <thead>
            <tr>
              <th>Expense Head</th>
              <th style={{ width: 180 }}>Monthly Budget</th>
              <th className="text-right">Actual (this month)</th>
              <th className="text-right">Remaining</th>
              <th style={{ width: 220 }}>Utilisation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const editing = drafts[r.head.id] !== undefined
              const over = r.pct != null && r.pct > 100
              return (
                <tr key={r.head.id}>
                  <td className="bold">{r.head.name}</td>
                  <td>
                    {canManage ? (
                      <div className="row gap-8 center">
                        <input
                          type="number"
                          className="input"
                          style={{ width: 110 }}
                          value={editing ? drafts[r.head.id] : r.budget || ''}
                          placeholder="0"
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.head.id]: e.target.value }))}
                          onBlur={() => editing && commit(r.head.id, r.currency)}
                          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        />
                        <span className="small muted">{r.currency}</span>
                      </div>
                    ) : r.budget > 0 ? (
                      formatMoney(r.budget, r.currency)
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="text-right nowrap ledger-out">{formatMoney(r.actual, r.currency)}</td>
                  <td className={`text-right nowrap ${r.budget > 0 && r.remaining < 0 ? 'ledger-out bold' : ''}`}>
                    {r.budget > 0 ? formatMoney(r.remaining, r.currency) : <span className="muted">—</span>}
                  </td>
                  <td>
                    {r.pct == null ? (
                      <span className="small muted">No budget set</span>
                    ) : (
                      <div>
                        <div className="budget-bar">
                          <div
                            className="budget-bar-fill"
                            style={{ width: `${Math.min(100, r.pct)}%`, background: barColor(r.pct) }}
                          />
                        </div>
                        <div className="small" style={{ marginTop: 3, color: over ? 'var(--red)' : 'var(--muted)' }}>
                          {r.pct}% used{over ? ` · over by ${formatMoney(-r.remaining, r.currency)}` : ''}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {expenseHeads.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  No expense heads configured. Add them in Settings → Finance Heads.
                </td>
              </tr>
            )}
          </tbody>
          {totals.budget > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td>Total</td>
                <td>{formatMoney(totals.budget, 'BDT')}</td>
                <td className="text-right nowrap ledger-out">{formatMoney(totals.actual, 'BDT')}</td>
                <td className={`text-right nowrap ${totals.remaining < 0 ? 'ledger-out' : ''}`}>{formatMoney(totals.remaining, 'BDT')}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="small muted mt-16">
        Budgets are a single monthly cap per head (they apply every month). The total row assumes one currency; set per-head
        currency where accounts differ.
      </p>
    </div>
  )
}
