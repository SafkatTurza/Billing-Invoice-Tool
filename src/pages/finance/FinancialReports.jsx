import { useMemo, useState } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatMoney, formatDate } from '../../lib/format.js'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/dashboard.css'
import '../../styles/finance.css'

// Phase C — Reports pack. Cash-flow statement, profit & loss, the auto-generated
// actual-expense summary, and receivables aging. Everything is grouped by
// currency (never mixed / converted, per SRS). Cash flow & expenses come from
// the posted ledger; revenue also folds in paid billing invoices.

function ym(s) {
  return (s || '').slice(0, 7)
}
function yr(s) {
  return (s || '').slice(0, 4)
}
function addByCur(map, cur, amt) {
  if (!cur) return
  map[cur] = (map[cur] || 0) + (Number(amt) || 0)
}
function curKeys(...maps) {
  const s = new Set()
  for (const m of maps) for (const k of Object.keys(m)) s.add(k)
  return [...s].sort()
}

export default function FinancialReports() {
  const { ledger, heads } = useFinance()
  const { docs, company } = useApp()
  const [period, setPeriod] = useState('month') // month | year | all
  const now = new Date()
  const thisMonth = now.toISOString().slice(0, 7)
  const thisYear = String(now.getFullYear())

  const inPeriod = (dateStr) => {
    if (period === 'all') return true
    if (period === 'year') return yr(dateStr) === thisYear
    return ym(dateStr) === thisMonth
  }
  const periodLabel = period === 'all' ? 'All time' : period === 'year' ? thisYear : formatDate(thisMonth + '-01').replace(/^\d+ /, '')

  // Posted ledger entries in the selected period. Internal account transfers are
  // excluded — they'd double-count as both income and expense in cash-flow / P&L.
  const posted = useMemo(
    () => ledger.filter((t) => t.status === 'posted' && t.linkType !== 'transfer' && inPeriod(t.txnDate)),
    [ledger, period],
  )

  // Paid billing invoices → revenue (kept separate from recorded income).
  const paidInvoices = useMemo(
    () => docs.filter((d) => d.type === 'invoices' && !d.deleted && d.status === 'Paid' && inPeriod(d.date)),
    [docs, period],
  )

  const report = useMemo(() => {
    const recordedIncome = {} // ledger 'in', kind income
    const investment = {} // ledger 'in', kind investment
    const billingIncome = {} // paid invoices
    const expenses = {} // ledger 'out'
    const expenseByHead = {} // cur → { headName → amt }

    for (const t of posted) {
      if (t.direction === 'in') {
        if (t.kind === 'investment') addByCur(investment, t.currency, t.amount)
        else addByCur(recordedIncome, t.currency, t.amount)
      } else {
        addByCur(expenses, t.currency, t.amount)
        const name = heads.find((h) => h.id === t.headId)?.name || 'Uncategorised'
        expenseByHead[t.currency] = expenseByHead[t.currency] || {}
        expenseByHead[t.currency][name] = (expenseByHead[t.currency][name] || 0) + (Number(t.amount) || 0)
      }
    }
    for (const d of paidInvoices) addByCur(billingIncome, d.currency, d.grandTotal)

    // Revenue = recorded income + billing income (investment is financing, not revenue).
    const revenue = {}
    for (const c of curKeys(recordedIncome, billingIncome)) addByCur(revenue, c, (recordedIncome[c] || 0) + (billingIncome[c] || 0))

    // Cash inflow = revenue + investment.
    const inflow = {}
    for (const c of curKeys(revenue, investment)) addByCur(inflow, c, (revenue[c] || 0) + (investment[c] || 0))

    return { recordedIncome, investment, billingIncome, expenses, expenseByHead, revenue, inflow }
  }, [posted, paidInvoices, heads])

  // Receivables aging — unpaid invoices bucketed by age (not period-filtered).
  const aging = useMemo(() => {
    const buckets = {} // cur → [0-30, 31-60, 61-90, 90+]
    const open = docs.filter((d) => d.type === 'invoices' && !d.deleted && d.status !== 'Paid' && d.status !== 'Draft')
    for (const d of open) {
      const ref = d.dueDate || d.date
      const days = Math.floor((now - new Date(ref)) / 86400000)
      const i = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3
      buckets[d.currency] = buckets[d.currency] || [0, 0, 0, 0]
      buckets[d.currency][i] += Number(d.grandTotal) || 0
    }
    return buckets
  }, [docs])

  const cashCurs = curKeys(report.inflow, report.expenses)
  const plCurs = curKeys(report.revenue, report.expenses)
  const expCurs = Object.keys(report.expenseByHead).sort()
  const agingCurs = Object.keys(aging).sort()

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title">Financial Reports</h1>
          <p className="page-sub">Cash flow, profit &amp; loss, expense summary and receivables aging — {periodLabel}.</p>
        </div>
        <div className="row gap-8 wrap no-print">
          <div className="seg">
            {[
              ['month', 'This Month'],
              ['year', 'This Year'],
              ['all', 'All Time'],
            ].map(([v, l]) => (
              <button key={v} className={`seg-btn${period === v ? ' active' : ''}`} onClick={() => setPeriod(v)}>
                {l}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
        </div>
      </div>

      <div className="report-print-head only-print">
        <h2>{company?.name || 'DreamCore Studio'} — Financial Reports</h2>
        <div className="muted">{periodLabel}</div>
      </div>

      <div className="grid grid-2 mt-16" style={{ alignItems: 'start' }}>
        {/* Cash Flow */}
        <ReportCard title="Cash Flow Statement">
          {cashCurs.length === 0 ? (
            <div className="empty">No cash movement in this period.</div>
          ) : (
            <table className="table report-table">
              <tbody>
                {cashCurs.map((c) => {
                  const net = (report.inflow[c] || 0) - (report.expenses[c] || 0)
                  return (
                    <FragmentRows key={c}>
                      <tr className="rt-cur">
                        <td colSpan={2}>{c}</td>
                      </tr>
                      <Row label="Billing income (paid invoices)" v={report.billingIncome[c]} cur={c} cls="ledger-in" />
                      <Row label="Recorded income" v={report.recordedIncome[c]} cur={c} cls="ledger-in" />
                      <Row label="Investment / capital" v={report.investment[c]} cur={c} cls="ledger-in" />
                      <Row label="Total inflow" v={report.inflow[c]} cur={c} cls="ledger-in" strong />
                      <Row label="Total outflow (expenses)" v={report.expenses[c] ? -report.expenses[c] : 0} cur={c} cls="ledger-out" />
                      <tr className="rt-total">
                        <td>Net Cash Flow</td>
                        <td className={`text-right nowrap ${net >= 0 ? 'ledger-in' : 'ledger-out'}`}>{formatMoney(net, c)}</td>
                      </tr>
                    </FragmentRows>
                  )
                })}
              </tbody>
            </table>
          )}
        </ReportCard>

        {/* Profit & Loss */}
        <ReportCard title="Profit &amp; Loss">
          {plCurs.length === 0 ? (
            <div className="empty">No revenue or expenses in this period.</div>
          ) : (
            <table className="table report-table">
              <tbody>
                {plCurs.map((c) => {
                  const profit = (report.revenue[c] || 0) - (report.expenses[c] || 0)
                  return (
                    <FragmentRows key={c}>
                      <tr className="rt-cur">
                        <td colSpan={2}>{c}</td>
                      </tr>
                      <Row label="Revenue" v={report.revenue[c]} cur={c} cls="ledger-in" strong />
                      <Row label="Expenses" v={report.expenses[c] ? -report.expenses[c] : 0} cur={c} cls="ledger-out" strong />
                      <tr className="rt-total">
                        <td>{profit >= 0 ? 'Net Profit' : 'Net Loss'}</td>
                        <td className={`text-right nowrap ${profit >= 0 ? 'ledger-in' : 'ledger-out'}`}>{formatMoney(profit, c)}</td>
                      </tr>
                    </FragmentRows>
                  )
                })}
              </tbody>
            </table>
          )}
          <p className="small muted" style={{ padding: '10px 16px' }}>
            Investment / capital is treated as financing and excluded from profit &amp; loss.
          </p>
        </ReportCard>
      </div>

      <div className="grid grid-2 mt-16" style={{ alignItems: 'start' }}>
        {/* Actual Expense Summary */}
        <ReportCard title="Actual Expense Summary (by head)">
          {expCurs.length === 0 ? (
            <div className="empty">No approved / recorded expenses in this period.</div>
          ) : (
            <table className="table report-table">
              <tbody>
                {expCurs.map((c) => {
                  const rows = Object.entries(report.expenseByHead[c]).sort((a, b) => b[1] - a[1])
                  return (
                    <FragmentRows key={c}>
                      <tr className="rt-cur">
                        <td colSpan={2}>{c}</td>
                      </tr>
                      {rows.map(([name, amt]) => (
                        <Row key={name} label={name} v={amt} cur={c} cls="ledger-out" />
                      ))}
                      <tr className="rt-total">
                        <td>Total</td>
                        <td className="text-right nowrap ledger-out">{formatMoney(report.expenses[c] || 0, c)}</td>
                      </tr>
                    </FragmentRows>
                  )
                })}
              </tbody>
            </table>
          )}
        </ReportCard>

        {/* Receivables Aging */}
        <ReportCard title="Receivables Aging (unpaid invoices)">
          {agingCurs.length === 0 ? (
            <div className="empty">No outstanding receivables.</div>
          ) : (
            <table className="table report-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="text-right">0–30</th>
                  <th className="text-right">31–60</th>
                  <th className="text-right">61–90</th>
                  <th className="text-right">90+</th>
                </tr>
              </thead>
              <tbody>
                {agingCurs.map((c) => (
                  <tr key={c}>
                    <td className="bold">{c}</td>
                    {aging[c].map((v, i) => (
                      <td key={i} className={`text-right nowrap ${v > 0 ? 'ledger-out' : 'muted'}`}>
                        {v ? formatMoney(v, c) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="small muted" style={{ padding: '10px 16px' }}>Days past invoice due date (or issue date). Draft invoices excluded.</p>
        </ReportCard>
      </div>
    </div>
  )
}

function ReportCard({ title, children }) {
  return (
    <div className="card report-card">
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--navy)' }}>{title}</div>
      {children}
    </div>
  )
}

function FragmentRows({ children }) {
  return <>{children}</>
}

function Row({ label, v, cur, cls, strong }) {
  if (!v) return null
  return (
    <tr className={strong ? 'rt-strong' : ''}>
      <td>{label}</td>
      <td className={`text-right nowrap ${cls || ''}`}>{formatMoney(v, cur)}</td>
    </tr>
  )
}
