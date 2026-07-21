import { useMemo, useState } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatMoney, formatDate, todayISO } from '../../lib/format.js'
import { trialBalance, ledgerByHead, accountStatement } from '../../lib/reports.js'
import { exportReport } from '../../lib/reportExport.js'
import { Icon } from '../../components/Icons.jsx'
import { useToast } from '../../components/Toast.jsx'
import '../../styles/dashboard.css'
import '../../styles/finance.css'

// Phase G — the accountant's-eye view of the ledger: a balancing trial balance,
// a general ledger drilled down by head, and a bank-statement-style running
// balance per account. All three export to Excel and print to PDF.

const VIEWS = [
  ['trial', 'Trial Balance'],
  ['head', 'Ledger by Head'],
  ['account', 'Account Statement'],
]

export default function GeneralLedger() {
  const { ledger, accounts, heads } = useFinance()
  const { company } = useApp()
  const toast = useToast()

  const [view, setView] = useState('trial')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(todayISO())
  const [headId, setHeadId] = useState(heads[0]?.id || '')
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')

  const accName = (id) => accounts.find((a) => a.id === id)?.name || '—'
  const headName = (id) => heads.find((h) => h.id === id)?.name || '—'

  const tb = useMemo(() => trialBalance(ledger, accounts, heads, to || undefined), [ledger, accounts, heads, to])
  const byHead = useMemo(() => ledgerByHead(ledger, headId, { from, to }), [ledger, headId, from, to])
  const account = accounts.find((a) => a.id === accountId)
  const stmt = useMemo(() => accountStatement(ledger, account, { from, to }), [ledger, account, from, to])

  const tbCurs = Object.keys(tb.currencies).sort()
  const rangeLabel = `${from ? formatDate(from) : 'start'} – ${to ? formatDate(to) : 'today'}`
  const asOfLabel = to ? formatDate(to) : formatDate(todayISO())

  const exportXlsx = async () => {
    const co = company?.name || 'DreamCore Studio'
    try {
      if (view === 'trial') {
        const sections = tbCurs.map((c) => ({
          title: `Trial Balance (${c}) — as of ${asOfLabel}`,
          columns: ['Account / Head', 'Type', 'Debit', 'Credit'],
          rows: [
            ...tb.currencies[c].rows.map((r) => [r.name, r.type, r.debit || '', r.credit || '']),
            ['TOTAL', '', tb.currencies[c].totalDebit, tb.currencies[c].totalCredit],
          ],
        }))
        await exportReport(`Trial_Balance_${to || todayISO()}.xlsx`, [{ name: 'Trial Balance', sections: sections.length ? sections : [{ title: `${co} — no data`, rows: [] }] }])
      } else if (view === 'head') {
        await exportReport(`Ledger_${headName(headId)}.xlsx`, [
          {
            name: 'Ledger by Head',
            sections: [
              {
                title: `${headName(headId)} · ${rangeLabel}`,
                columns: ['Date', 'Reference', 'Description', 'Account', 'In', 'Out'],
                rows: byHead.rows.map((t) => [formatDate(t.txnDate || t.createdAt), t.docNumber || '', t.description || '', accName(t.accountId), t.direction === 'in' ? t.amount : '', t.direction === 'out' ? t.amount : '']),
              },
            ],
          },
        ])
      } else {
        await exportReport(`Statement_${accName(accountId)}.xlsx`, [
          {
            name: 'Account Statement',
            sections: [
              {
                title: `${accName(accountId)} · ${rangeLabel}`,
                columns: ['Date', 'Reference', 'Description', 'In', 'Out', 'Balance'],
                rows: [
                  ['Opening balance', '', '', '', '', stmt.opening],
                  ...stmt.rows.map((t) => [formatDate(t.txnDate || t.createdAt), t.docNumber || '', t.description || '', t.direction === 'in' ? t.amount : '', t.direction === 'out' ? t.amount : '', t.balance]),
                  ['Closing balance', '', '', stmt.totalIn, stmt.totalOut, stmt.closing],
                ],
              },
            ],
          },
        ])
      }
      toast.success('Exported to Excel.')
    } catch (e) {
      toast.error('Export failed.')
    }
  }

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div>
          <h1 className="page-title">General Ledger</h1>
          <p className="page-sub">Trial balance, ledger by head, and per-account statements — from the posted ledger.</p>
        </div>
        <div className="row gap-8 wrap no-print">
          <button className="btn btn-ghost" onClick={exportXlsx}>
            <Icon.download width={15} height={15} /> Excel
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon.print width={15} height={15} /> Print / PDF
          </button>
        </div>
      </div>

      <div className="card card-pad no-print mt-16">
        <div className="row gap-8 wrap center">
          <div className="seg">
            {VIEWS.map(([v, l]) => (
              <button key={v} className={`seg-btn${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
                {l}
              </button>
            ))}
          </div>
          <div className="spacer" style={{ flex: 1 }} />
          {view === 'head' && (
            <select className="select" style={{ width: 200 }} value={headId} onChange={(e) => setHeadId(e.target.value)}>
              {heads.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
              <option value="none">— Uncategorised —</option>
            </select>
          )}
          {view === 'account' && (
            <select className="select" style={{ width: 200 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          {view !== 'trial' && (
            <input type="date" className="input" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
          )}
          <input type="date" className="input" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} title={view === 'trial' ? 'As-of date' : 'To date'} />
        </div>
      </div>

      <div className="report-print-head only-print">
        <h2>{company?.name || 'DreamCore Studio'} — {VIEWS.find((v) => v[0] === view)[1]}</h2>
        <div className="muted">{view === 'trial' ? `As of ${asOfLabel}` : rangeLabel}</div>
      </div>

      {view === 'trial' && <TrialBalanceView tb={tb} curs={tbCurs} asOf={asOfLabel} />}
      {view === 'head' && <ByHeadView data={byHead} headName={headName(headId)} accName={accName} rangeLabel={rangeLabel} />}
      {view === 'account' && <StatementView stmt={stmt} account={account} accName={accName} rangeLabel={rangeLabel} />}
    </div>
  )
}

function TrialBalanceView({ tb, curs, asOf }) {
  if (curs.length === 0) return <div className="card mt-16"><div className="empty">No ledger activity as of {asOf}.</div></div>
  return (
    <div className="mt-16 grid" style={{ gap: 16 }}>
      {curs.map((c) => {
        const g = tb.currencies[c]
        return (
          <div key={c} className="card report-card">
            <div className="rc-head">
              {c} · as of {asOf}
              <span className={`badge ${g.balanced ? 'badge-green' : 'badge-amber'}`} style={{ marginLeft: 10 }}>
                {g.balanced ? 'Balanced' : 'Out of balance'}
              </span>
            </div>
            <table className="table report-table">
              <thead>
                <tr>
                  <th>Account / Head</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={i} className={r.type === 'equity' ? 'muted' : ''}>
                    <td>{r.name}{r.type === 'account' && <span className="tag-soft">asset</span>}</td>
                    <td className="text-right nowrap">{r.debit ? formatMoney(r.debit, c) : ''}</td>
                    <td className="text-right nowrap">{r.credit ? formatMoney(r.credit, c) : ''}</td>
                  </tr>
                ))}
                <tr className="rt-total">
                  <td>Total</td>
                  <td className="text-right nowrap">{formatMoney(g.totalDebit, c)}</td>
                  <td className="text-right nowrap">{formatMoney(g.totalCredit, c)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}
      <p className="small muted">
        Cash/bank accounts are assets (debit). Income &amp; investment heads are credits, expense heads are
        debits. Opening balances are carried by an Opening Balance Equity credit so the sheet balances.
      </p>
    </div>
  )
}

function ByHeadView({ data, headName, accName, rangeLabel }) {
  const curs = Object.keys(data.byCurrency).sort()
  return (
    <div className="card report-card mt-16">
      <div className="rc-head">{headName} · {rangeLabel}</div>
      {data.rows.length === 0 ? (
        <div className="empty">No postings against this head in the range.</div>
      ) : (
        <table className="table report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th>Account</th>
              <th className="text-right">In</th>
              <th className="text-right">Out</th>
              <th className="text-right">Running</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((t) => (
              <tr key={t.id}>
                <td className="small nowrap">{formatDate(t.txnDate || t.createdAt)}</td>
                <td className="mono small">{t.docNumber || '—'}</td>
                <td>{t.description || '—'}</td>
                <td className="small">{accName(t.accountId)}</td>
                <td className="text-right nowrap ledger-in">{t.direction === 'in' ? formatMoney(t.amount, t.currency) : ''}</td>
                <td className="text-right nowrap ledger-out">{t.direction === 'out' ? formatMoney(t.amount, t.currency) : ''}</td>
                <td className={`text-right nowrap ${t.runningNet >= 0 ? 'ledger-in' : 'ledger-out'}`}>{formatMoney(t.runningNet, t.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {curs.map((c) => (
              <tr key={c} className="rt-total">
                <td colSpan={4}>Net ({c})</td>
                <td className="text-right nowrap ledger-in">{formatMoney(data.byCurrency[c].in, c)}</td>
                <td className="text-right nowrap ledger-out">{formatMoney(data.byCurrency[c].out, c)}</td>
                <td className={`text-right nowrap ${data.byCurrency[c].net >= 0 ? 'ledger-in' : 'ledger-out'}`}>{formatMoney(data.byCurrency[c].net, c)}</td>
              </tr>
            ))}
          </tfoot>
        </table>
      )}
    </div>
  )
}

function StatementView({ stmt, account, accName, rangeLabel }) {
  const cur = account?.currency || 'BDT'
  return (
    <div className="card report-card mt-16">
      <div className="rc-head">{accName(account?.id)} · {rangeLabel}</div>
      <table className="table report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Reference</th>
            <th>Description</th>
            <th className="text-right">In</th>
            <th className="text-right">Out</th>
            <th className="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="rt-strong">
            <td colSpan={5}>Opening balance</td>
            <td className="text-right nowrap">{formatMoney(stmt.opening, cur)}</td>
          </tr>
          {stmt.rows.map((t) => (
            <tr key={t.id}>
              <td className="small nowrap">{formatDate(t.txnDate || t.createdAt)}</td>
              <td className="mono small">{t.linkType === 'transfer' ? <span className="badge badge-blue">Transfer</span> : t.docNumber || '—'}</td>
              <td>{t.description || '—'}</td>
              <td className="text-right nowrap ledger-in">{t.direction === 'in' ? formatMoney(t.amount, cur) : ''}</td>
              <td className="text-right nowrap ledger-out">{t.direction === 'out' ? formatMoney(t.amount, cur) : ''}</td>
              <td className="text-right nowrap">{formatMoney(t.balance, cur)}</td>
            </tr>
          ))}
          {stmt.rows.length === 0 && (
            <tr>
              <td colSpan={6} className="empty" style={{ textAlign: 'center' }}>No movement in this range.</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="rt-total">
            <td colSpan={3}>Closing balance</td>
            <td className="text-right nowrap ledger-in">{formatMoney(stmt.totalIn, cur)}</td>
            <td className="text-right nowrap ledger-out">{formatMoney(stmt.totalOut, cur)}</td>
            <td className="text-right nowrap">{formatMoney(stmt.closing, cur)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
