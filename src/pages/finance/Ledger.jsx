import { useState, useMemo } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { formatMoney, formatDate } from '../../lib/format.js'
import { Icon } from '../../components/Icons.jsx'

// The ledger — every posted money movement. This is the central record.
export default function Ledger() {
  const { ledger, accounts, heads } = useFinance()
  const [accFilter, setAccFilter] = useState('all')
  const [dirFilter, setDirFilter] = useState('all')
  const [query, setQuery] = useState('')

  const accName = (id) => accounts.find((a) => a.id === id)?.name || '—'
  const headName = (id) => heads.find((h) => h.id === id)?.name || '—'

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ledger
      .filter((t) => t.status === 'posted')
      .filter((t) => accFilter === 'all' || t.accountId === accFilter)
      .filter((t) => dirFilter === 'all' || t.direction === dirFilter)
      .filter((t) => !q || (t.description || '').toLowerCase().includes(q) || (t.docNumber || '').toLowerCase().includes(q) || (t.partyName || '').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.txnDate || b.createdAt) - new Date(a.txnDate || a.createdAt))
  }, [ledger, accFilter, dirFilter, query])

  const totals = useMemo(() => {
    const t = { in: {}, out: {} }
    for (const r of rows) {
      const bucket = r.direction === 'in' ? t.in : r.direction === 'out' ? t.out : null
      if (bucket) bucket[r.currency] = (bucket[r.currency] || 0) + (Number(r.amount) || 0)
    }
    return t
  }, [rows])

  return (
    <div>
      <h1 className="page-title">Ledger</h1>
      <p className="page-sub">Every posted financial transaction — the company's central money record.</p>

      <div className="fin-kpis mt-24" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 640 }}>
        <div className="fin-kpi">
          <div className="k-label">Money In</div>
          <div className="k-val in">
            {Object.entries(totals.in).map(([c, v]) => (
              <div key={c} style={{ fontSize: 18 }}>{formatMoney(v, c)}</div>
            ))}
            {Object.keys(totals.in).length === 0 && '—'}
          </div>
        </div>
        <div className="fin-kpi">
          <div className="k-label">Money Out</div>
          <div className="k-val out">
            {Object.entries(totals.out).map(([c, v]) => (
              <div key={c} style={{ fontSize: 18 }}>{formatMoney(v, c)}</div>
            ))}
            {Object.keys(totals.out).length === 0 && '—'}
          </div>
        </div>
      </div>

      <div className="card mt-24">
        <div className="list-toolbar">
          <div className="global-search">
            <span className="icon">
              <Icon.search width={16} height={16} />
            </span>
            <input placeholder="Search ledger…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="select" style={{ width: 180 }} value={accFilter} onChange={(e) => setAccFilter(e.target.value)}>
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 150 }} value={dirFilter} onChange={(e) => setDirFilter(e.target.value)}>
            <option value="all">In &amp; Out</option>
            <option value="in">Money In</option>
            <option value="out">Money Out</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="empty">No transactions yet. Approved vouchers and recorded expenses appear here.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Head</th>
                <th>Account</th>
                <th className="text-right">In</th>
                <th className="text-right">Out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="small nowrap">{formatDate(t.txnDate || t.createdAt)}</td>
                  <td className="mono small">{t.docNumber || '—'}</td>
                  <td>{t.description || '—'}</td>
                  <td className="small">{headName(t.headId)}</td>
                  <td className="small">{accName(t.accountId)}</td>
                  <td className="text-right nowrap ledger-in">{t.direction === 'in' ? formatMoney(t.amount, t.currency) : ''}</td>
                  <td className="text-right nowrap ledger-out">{t.direction === 'out' ? formatMoney(t.amount, t.currency) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
