import { useState, useMemo } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { txnBase } from '../../lib/finance.js'
import { CURRENCIES, formatMoney, formatDate, todayISO } from '../../lib/format.js'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'

// The ledger — every posted money movement. This is the central record.
export default function Ledger() {
  const { ledger, accounts, heads, postTransfer } = useFinance()
  const { currentUser } = useApp()
  const toast = useToast()
  const canManage = can(currentUser.role, 'financeManage')

  const [accFilter, setAccFilter] = useState('all')
  const [dirFilter, setDirFilter] = useState('all')
  const [headFilter, setHeadFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('')
  const [xfer, setXfer] = useState(null)

  const accName = (id) => accounts.find((a) => a.id === id)?.name || '—'
  const headName = (id) => heads.find((h) => h.id === id)?.name || '—'

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ledger
      .filter((t) => t.status === 'posted')
      .filter((t) => accFilter === 'all' || t.accountId === accFilter)
      .filter((t) => dirFilter === 'all' || t.direction === dirFilter)
      .filter((t) => headFilter === 'all' || (headFilter === 'none' ? !t.headId : t.headId === headFilter))
      .filter((t) => !from || (t.txnDate || '') >= from)
      .filter((t) => !to || (t.txnDate || '') <= to)
      .filter((t) => !q || (t.description || '').toLowerCase().includes(q) || (t.docNumber || '').toLowerCase().includes(q) || (t.partyName || '').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.txnDate || b.createdAt) - new Date(a.txnDate || a.createdAt))
  }, [ledger, accFilter, dirFilter, headFilter, from, to, query])

  const totals = useMemo(() => {
    const t = { in: {}, out: {}, baseIn: 0, baseOut: 0 }
    for (const r of rows) {
      const bucket = r.direction === 'in' ? t.in : r.direction === 'out' ? t.out : null
      if (bucket) bucket[r.currency] = (bucket[r.currency] || 0) + (Number(r.amount) || 0)
      if (r.direction === 'in') t.baseIn += txnBase(r)
      else if (r.direction === 'out') t.baseOut += txnBase(r)
    }
    return t
  }, [rows])

  const openTransfer = () =>
    setXfer({
      fromAccountId: accounts[0]?.id || '',
      toAccountId: accounts[1]?.id || accounts[0]?.id || '',
      amount: '',
      currency: 'BDT',
      date: todayISO(),
      note: '',
    })

  const saveTransfer = () => {
    if (!xfer.fromAccountId || !xfer.toAccountId) return toast.error('Choose both accounts.')
    if (xfer.fromAccountId === xfer.toAccountId) return toast.error('Choose two different accounts.')
    if (!(Number(xfer.amount) > 0)) return toast.error('Enter an amount.')
    postTransfer(xfer)
    toast.success('Transfer recorded.')
    setXfer(null)
  }

  const filtersOn = accFilter !== 'all' || dirFilter !== 'all' || headFilter !== 'all' || from || to || query
  const clearFilters = () => {
    setAccFilter('all'); setDirFilter('all'); setHeadFilter('all'); setFrom(''); setTo(''); setQuery('')
  }

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">Ledger</h1>
          <p className="page-sub">Every posted financial transaction — the company's central money record.</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={openTransfer}>
            <Icon.money width={16} height={16} /> New Transfer
          </button>
        )}
      </div>

      <div className="fin-kpis mt-24" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 640 }}>
        <div className="fin-kpi">
          <div className="k-label">Money In</div>
          <div className="k-val in">
            {Object.entries(totals.in).map(([c, v]) => (
              <div key={c} style={{ fontSize: 18 }}>{formatMoney(v, c)}</div>
            ))}
            {Object.keys(totals.in).length === 0 && '—'}
            {Object.keys(totals.in).length > 1 && (
              <div className="k-sub">≈ {formatMoney(totals.baseIn, 'BDT')} consolidated</div>
            )}
          </div>
        </div>
        <div className="fin-kpi">
          <div className="k-label">Money Out</div>
          <div className="k-val out">
            {Object.entries(totals.out).map(([c, v]) => (
              <div key={c} style={{ fontSize: 18 }}>{formatMoney(v, c)}</div>
            ))}
            {Object.keys(totals.out).length === 0 && '—'}
            {Object.keys(totals.out).length > 1 && (
              <div className="k-sub">≈ {formatMoney(totals.baseOut, 'BDT')} consolidated</div>
            )}
          </div>
        </div>
      </div>

      <div className="card mt-24">
        <div className="list-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="global-search">
            <span className="icon">
              <Icon.search width={16} height={16} />
            </span>
            <input placeholder="Search ledger…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="select" style={{ width: 160 }} value={accFilter} onChange={(e) => setAccFilter(e.target.value)}>
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select className="select" style={{ width: 170 }} value={headFilter} onChange={(e) => setHeadFilter(e.target.value)}>
            <option value="all">All heads</option>
            {heads.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
            <option value="none">— No head —</option>
          </select>
          <select className="select" style={{ width: 130 }} value={dirFilter} onChange={(e) => setDirFilter(e.target.value)}>
            <option value="all">In &amp; Out</option>
            <option value="in">Money In</option>
            <option value="out">Money Out</option>
          </select>
          <input type="date" className="input" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input type="date" className="input" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
          {filtersOn && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="empty">No transactions{filtersOn ? ' match these filters' : ' yet. Approved vouchers and recorded expenses appear here'}.</div>
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
                  <td className="mono small">
                    {t.linkType === 'transfer' ? <span className="badge badge-blue">Transfer</span> : t.docNumber || '—'}
                  </td>
                  <td>{t.description || '—'}</td>
                  <td className="small">{t.linkType === 'transfer' ? '—' : headName(t.headId)}</td>
                  <td className="small">{accName(t.accountId)}</td>
                  <td className="text-right nowrap ledger-in">
                    {t.direction === 'in' ? formatMoney(t.amount, t.currency) : ''}
                    {t.direction === 'in' && (t.currency || 'BDT') !== 'BDT' && (
                      <div className="small muted">≈ {formatMoney(txnBase(t), 'BDT')}</div>
                    )}
                  </td>
                  <td className="text-right nowrap ledger-out">
                    {t.direction === 'out' ? formatMoney(t.amount, t.currency) : ''}
                    {t.direction === 'out' && (t.currency || 'BDT') !== 'BDT' && (
                      <div className="small muted">≈ {formatMoney(txnBase(t), 'BDT')}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {xfer && (
        <Modal
          title="New Account Transfer"
          width={520}
          onClose={() => setXfer(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setXfer(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTransfer}>
                <Icon.check width={16} height={16} /> Record Transfer
              </button>
            </>
          }
        >
          <p className="small muted" style={{ marginBottom: 12 }}>
            Moves money between your own accounts (e.g. Cash → Bank). It posts a matched out+in pair and
            does not count as income or expense.
          </p>
          <div className="grid grid-2">
            <div className="field">
              <label>From Account</label>
              <select className="select" value={xfer.fromAccountId} onChange={(e) => setXfer((x) => ({ ...x, fromAccountId: e.target.value }))}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>To Account</label>
              <select className="select" value={xfer.toAccountId} onChange={(e) => setXfer((x) => ({ ...x, toAccountId: e.target.value }))}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" className="input" value={xfer.amount} onChange={(e) => setXfer((x) => ({ ...x, amount: e.target.value }))} />
            </div>
            <div className="field">
              <label>Currency</label>
              <select className="select" value={xfer.currency} onChange={(e) => setXfer((x) => ({ ...x, currency: e.target.value }))}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" className="input" value={xfer.date} onChange={(e) => setXfer((x) => ({ ...x, date: e.target.value }))} />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Note (optional)</label>
              <input className="input" value={xfer.note} onChange={(e) => setXfer((x) => ({ ...x, note: e.target.value }))} placeholder="e.g. Cash deposit to bank" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
