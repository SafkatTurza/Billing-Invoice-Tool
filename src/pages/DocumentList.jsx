import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { canSeeDocument, can } from '../lib/roles.js'
import { metaFor } from '../lib/docmeta.js'
import { formatMoney, formatDate } from '../lib/format.js'
import StatusBadge, { STATUS_OPTIONS } from '../components/StatusBadge.jsx'
import { Icon } from '../components/Icons.jsx'
import { useConfirm } from '../components/ConfirmDialog.jsx'
import '../styles/documents.css'

// Statuses that count as "unpaid but issued" (invoice dashboard tab).
const UNPAID_STATUSES = ['Sent', 'Approved', 'Partial', 'Overdue']
const isUnpaid = (s) => UNPAID_STATUSES.includes(s)

export default function DocumentList({ type }) {
  const { docs, currentUser, deleteDocument } = useApp()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const meta = metaFor(type)
  const isInvoice = type === 'invoices'

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('date-new')
  const [tab, setTab] = useState('all') // invoices: all | unpaid | draft

  const mine = useMemo(
    () =>
      docs
        .filter((d) => d.type === type && !d.deleted)
        .filter((d) => canSeeDocument(currentUser, d)),
    [docs, type, currentUser],
  )

  const statusesPresent = useMemo(() => {
    const set = new Set(mine.map((d) => d.status).filter(Boolean))
    return Array.from(set)
  }, [mine])

  // Invoice-only KPIs + tab counts.
  const inv = useMemo(() => {
    if (!isInvoice) return null
    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 864e5)
    let overdue = 0
    let due30 = 0
    const paidDays = []
    const curCount = {}
    for (const d of mine) {
      const amt = Number(d.grandTotal) || 0
      if (d.currency) curCount[d.currency] = (curCount[d.currency] || 0) + 1
      const due = d.dueDate ? new Date(d.dueDate) : null
      if (isUnpaid(d.status)) {
        if (d.status === 'Overdue' || (due && due < now)) overdue += amt
        else if (due && due <= in30) due30 += amt
      }
      if (d.status === 'Paid' && d.paidInfo?.date && d.date) {
        const days = (new Date(d.paidInfo.date) - new Date(d.date)) / 864e5
        if (days >= 0) paidDays.push(days)
      }
    }
    const avg = paidDays.length ? Math.round(paidDays.reduce((a, b) => a + b, 0) / paidDays.length) : null
    const cur = Object.entries(curCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'BDT'
    return {
      overdue,
      due30,
      avg,
      cur,
      counts: {
        all: mine.length,
        unpaid: mine.filter((d) => isUnpaid(d.status)).length,
        draft: mine.filter((d) => d.status === 'Draft').length,
      },
    }
  }, [mine, isInvoice])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = mine.filter((d) => {
      const matchQ =
        !q ||
        (d.docNumber || '').toLowerCase().includes(q) ||
        (d.partyName || '').toLowerCase().includes(q) ||
        (d.reference || '').toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || d.status === statusFilter
      const matchTab =
        !isInvoice ||
        tab === 'all' ||
        (tab === 'unpaid' && isUnpaid(d.status)) ||
        (tab === 'draft' && d.status === 'Draft')
      return matchQ && matchStatus && matchTab
    })
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'date-new':
          return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
        case 'date-old':
          return new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)
        case 'amount-high':
          return (b.grandTotal || 0) - (a.grandTotal || 0)
        case 'amount-low':
          return (a.grandTotal || 0) - (b.grandTotal || 0)
        default:
          return 0
      }
    })
    return list
  }, [mine, query, statusFilter, sort, tab, isInvoice])

  const canDelete = can(currentUser.role, 'deleteDocuments')

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">{meta.plural}</h1>
          <p className="page-sub">
            {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate(`/${type}/new`)}>
          <Icon.plus width={16} height={16} /> New {meta.singular}
        </button>
      </div>

      {inv && (
        <div className="inv-kpis mt-16">
          <div className="inv-kpi">
            <span className="ik-label">Overdue</span>
            <span className="ik-value overdue">{formatMoney(inv.overdue, inv.cur)}</span>
          </div>
          <div className="inv-kpi">
            <span className="ik-label">Due within next 30 days</span>
            <span className="ik-value">{formatMoney(inv.due30, inv.cur)}</span>
          </div>
          <div className="inv-kpi">
            <span className="ik-label">Average time to get paid</span>
            <span className="ik-value">{inv.avg == null ? '—' : `${inv.avg} days`}</span>
          </div>
        </div>
      )}

      <div className="card mt-24">
        {inv && (
          <div className="inv-tabs">
            {[
              ['unpaid', 'Unpaid', inv.counts.unpaid],
              ['draft', 'Draft', inv.counts.draft],
              ['all', 'All invoices', null],
            ].map(([id, label, count]) => (
              <button
                key={id}
                className={`inv-tab ${tab === id ? 'on' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
                {count != null ? <span className="inv-tab-count">{count}</span> : null}
              </button>
            ))}
          </div>
        )}

        <div className="list-toolbar">
          <div className="global-search">
            <span className="icon">
              <Icon.search width={16} height={16} />
            </span>
            <input
              placeholder={`Search ${meta.plural.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="select" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {statusesPresent.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 190 }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="date-new">Date (Newest)</option>
            <option value="date-old">Date (Oldest)</option>
            <option value="amount-high">Amount (High → Low)</option>
            <option value="amount-low">Amount (Low → High)</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            No {meta.plural.toLowerCase()} found.{' '}
            <a style={{ color: 'var(--brand-dark)', fontWeight: 600 }} onClick={() => navigate(`/${type}/new`)}>
              Create one →
            </a>
          </div>
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>{meta.partyLabel}</th>
                <th>Reference</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td className="mono bold" style={{ cursor: 'pointer' }} onClick={() => navigate(`/${type}/${d.id}`)}>
                    {d.docNumber}
                  </td>
                  <td className="small nowrap">{formatDate(d.date)}</td>
                  <td>{d.partyName || '—'}</td>
                  <td className="small muted">{d.reference || '—'}</td>
                  <td className="text-right nowrap">{formatMoney(d.grandTotal, d.currency)}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="text-right nowrap">
                    <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/${type}/${d.id}`)} title="View">
                        <Icon.eye width={14} height={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/${type}/${d.id}/edit`)} title="Edit">
                        <Icon.edit width={14} height={14} />
                      </button>
                      {canDelete && (
                        <button
                          className="btn btn-danger btn-sm"
                          title="Delete"
                          onClick={async () => {
                            if (
                              await confirm({
                                title: 'Move to Recycle Bin?',
                                message: `${d.docNumber} will be moved to the Recycle Bin. You can restore it later.`,
                                confirmLabel: 'Move to Recycle Bin',
                              })
                            )
                              deleteDocument(d.id)
                          }}
                        >
                          <Icon.trash width={14} height={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  )
}
