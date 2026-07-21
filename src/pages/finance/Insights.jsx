import { useMemo, useState } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatMoney } from '../../lib/format.js'
import {
  ledgerCurrencies,
  monthlyTrends,
  expenseHeadsOverWindow,
  cashFlowForecast,
} from '../../lib/reports.js'
import { exportReport } from '../../lib/reportExport.js'
import MiniChart from '../../components/finance/MiniChart.jsx'
import { Icon } from '../../components/Icons.jsx'
import { useToast } from '../../components/Toast.jsx'
import '../../styles/dashboard.css'
import '../../styles/finance.css'

// Phase G — the at-a-glance view: how income and spending have moved month to
// month, where the money goes, and where cash is heading next. Charts are plain
// inline SVG (no charting library) so they print cleanly with the rest.

const GREEN = '#059669'
const RED = '#dc2626'
const NAVY = '#1E2D5A'
const BLUE = '#2563eb'

export default function Insights() {
  const { ledger, accounts, heads, recurring, finDocs } = useFinance()
  const { docs, company } = useApp()
  const toast = useToast()

  const curs = useMemo(() => {
    const c = ledgerCurrencies(ledger, accounts)
    return c.length ? c : ['BDT']
  }, [ledger, accounts])
  const [currency, setCurrency] = useState(curs[0])
  const [months, setMonths] = useState(6)
  const cur = curs.includes(currency) ? currency : curs[0]

  const bills = useMemo(() => finDocs.filter((d) => d.type === 'bill' && !d.deleted), [finDocs])
  const invoices = docs

  const trends = useMemo(() => monthlyTrends(ledger, invoices, cur, months), [ledger, invoices, cur, months])
  const topHeads = useMemo(() => expenseHeadsOverWindow(ledger, heads, cur, months), [ledger, heads, cur, months])
  const forecast = useMemo(
    () => cashFlowForecast({ ledger, accounts, recurring, bills, invoices }, cur, months),
    [ledger, accounts, recurring, bills, invoices, cur, months],
  )

  const trendLabels = trends.series.map((s) => s.label)
  const headMax = topHeads.reduce((m, h) => Math.max(m, h.total), 0) || 1
  const fmt = (v) => formatMoney(v, cur)

  const exportXlsx = async () => {
    try {
      await exportReport(`Insights_${cur}.xlsx`, [
        {
          name: 'Monthly Trend',
          sections: [
            {
              title: `Income vs Expense (${cur}) — last ${months} months`,
              columns: ['Month', 'Income', 'Investment', 'Expense', 'Net'],
              rows: trends.series.map((s) => [s.label, s.income, s.investment, s.expense, s.net]),
            },
            {
              title: 'Expense by head (window)',
              columns: ['Head', 'Total'],
              rows: topHeads.map((h) => [h.name, h.total]),
            },
          ],
        },
        {
          name: 'Cash Flow Forecast',
          sections: [
            {
              title: `Forecast (${cur}) — opening ${formatMoney(forecast.startBalance, cur)}`,
              columns: ['Month', 'Expected In', 'Expected Out', 'Net', 'Projected Balance'],
              rows: forecast.rows.map((r) => [r.label, r.inflow, r.outflow, r.net, r.balance]),
            },
          ],
        },
      ])
      toast.success('Exported to Excel.')
    } catch (e) {
      toast.error('Export failed.')
    }
  }

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title">Insights &amp; Forecast</h1>
          <p className="page-sub">Income &amp; spending trends, where the money goes, and a cash-flow projection.</p>
        </div>
        <div className="row gap-8 wrap no-print">
          <select className="select" style={{ width: 100 }} value={cur} onChange={(e) => setCurrency(e.target.value)}>
            {curs.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div className="seg">
            {[6, 12].map((m) => (
              <button key={m} className={`seg-btn${months === m ? ' active' : ''}`} onClick={() => setMonths(m)}>
                {m} mo
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={exportXlsx}>
            <Icon.download width={15} height={15} /> Excel
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
        </div>
      </div>

      <div className="report-print-head only-print">
        <h2>{company?.name || 'DreamCore Studio'} — Insights &amp; Forecast ({cur})</h2>
        <div className="muted">Trailing {months} months + {months}-month projection</div>
      </div>

      {/* Income vs expense trend */}
      <div className="card report-card mt-16">
        <div className="rc-head">Income vs Expense — last {months} months ({cur})</div>
        <div className="chart-wrap">
          <MiniChart
            labels={trendLabels}
            bars={[
              { label: 'Income', color: GREEN, values: trends.series.map((s) => s.income) },
              { label: 'Expense', color: RED, values: trends.series.map((s) => s.expense) },
            ]}
            line={{ label: 'Net', color: NAVY, values: trends.series.map((s) => s.net) }}
            fmt={(v) => Math.round(v).toLocaleString('en-US')}
          />
        </div>
      </div>

      <div className="grid grid-2 mt-16" style={{ alignItems: 'start' }}>
        {/* Top expense heads */}
        <div className="card report-card">
          <div className="rc-head">Where the money goes ({cur})</div>
          {topHeads.length === 0 ? (
            <div className="empty">No expenses in this window.</div>
          ) : (
            <div className="head-bars">
              {topHeads.map((h) => (
                <div key={h.name} className="head-bar-row">
                  <div className="hb-label" title={h.name}>{h.name}</div>
                  <div className="hb-track">
                    <div className="hb-fill" style={{ width: `${Math.max(3, (h.total / headMax) * 100)}%` }} />
                  </div>
                  <div className="hb-val">{fmt(h.total)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Forecast summary numbers */}
        <div className="card report-card">
          <div className="rc-head">Projection summary ({cur})</div>
          <div className="fc-summary">
            <SummaryRow label="Cash on hand now" value={fmt(forecast.startBalance)} strong />
            <SummaryRow label="Recurring cost / month" value={fmt(forecast.recurringMonthly)} tone="out" />
            <SummaryRow label={`Projected in (${months} mo)`} value={fmt(forecast.rows.reduce((s, r) => s + r.inflow, 0))} tone="in" />
            <SummaryRow label={`Projected out (${months} mo)`} value={fmt(forecast.rows.reduce((s, r) => s + r.outflow, 0))} tone="out" />
            <SummaryRow
              label={`Projected balance in ${months} mo`}
              value={fmt(forecast.rows.length ? forecast.rows[forecast.rows.length - 1].balance : forecast.startBalance)}
              strong
              tone={(forecast.rows[forecast.rows.length - 1]?.balance ?? forecast.startBalance) >= 0 ? 'in' : 'out'}
            />
          </div>
          <p className="small muted" style={{ padding: '4px 16px 14px' }}>
            Projection is indicative: recurring templates repeat each month, open bills land in their due month,
            and unpaid invoices are expected in their due month. Nothing here posts to the ledger.
          </p>
        </div>
      </div>

      {/* Cash-flow forecast chart + table */}
      <div className="card report-card mt-16">
        <div className="rc-head">Cash-flow forecast — next {months} months ({cur})</div>
        <div className="chart-wrap">
          <MiniChart
            labels={forecast.rows.map((r) => r.label)}
            bars={[
              { label: 'Expected in', color: GREEN, values: forecast.rows.map((r) => r.inflow) },
              { label: 'Expected out', color: RED, values: forecast.rows.map((r) => r.outflow) },
            ]}
            line={{ label: 'Projected balance', color: BLUE, values: forecast.rows.map((r) => r.balance) }}
            fmt={(v) => Math.round(v).toLocaleString('en-US')}
          />
        </div>
        <table className="table report-table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">Expected In</th>
              <th className="text-right">Expected Out</th>
              <th className="text-right">Net</th>
              <th className="text-right">Projected Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="rt-strong">
              <td colSpan={4}>Opening (cash on hand)</td>
              <td className="text-right nowrap">{fmt(forecast.startBalance)}</td>
            </tr>
            {forecast.rows.map((r) => (
              <tr key={r.ym}>
                <td className="nowrap">{r.label}</td>
                <td className="text-right nowrap ledger-in">{r.inflow ? fmt(r.inflow) : '—'}</td>
                <td className="text-right nowrap ledger-out">{r.outflow ? fmt(r.outflow) : '—'}</td>
                <td className={`text-right nowrap ${r.net >= 0 ? 'ledger-in' : 'ledger-out'}`}>{fmt(r.net)}</td>
                <td className={`text-right nowrap ${r.balance >= 0 ? '' : 'ledger-out'}`}>{fmt(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, strong, tone }) {
  return (
    <div className={`fc-row${strong ? ' strong' : ''}`}>
      <span className="fc-label">{label}</span>
      <span className={`fc-value ${tone === 'in' ? 'ledger-in' : tone === 'out' ? 'ledger-out' : ''}`}>{value}</span>
    </div>
  )
}
