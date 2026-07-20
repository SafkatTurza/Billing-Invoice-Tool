import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { canSeeDocument, can } from '../lib/roles.js'
import { metaFor } from '../lib/docmeta.js'
import { formatMoney, formatDate } from '../lib/format.js'
import StatusBadge, { STATUS_OPTIONS } from '../components/StatusBadge.jsx'
import { Icon } from '../components/Icons.jsx'
import '../styles/documents.css'

export default function DocumentList({ type }) {
  const { docs, currentUser, deleteDocument } = useApp()
  const navigate = useNavigate()
  const meta = metaFor(type)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('date-new')

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = mine.filter((d) => {
      const matchQ =
        !q ||
        (d.docNumber || '').toLowerCase().includes(q) ||
        (d.partyName || '').toLowerCase().includes(q) ||
        (d.reference || '').toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || d.status === statusFilter
      return matchQ && matchStatus
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
  }, [mine, query, statusFilter, sort])

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

      <div className="card mt-24">
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
            <a style={{ color: 'var(--navy)', fontWeight: 600 }} onClick={() => navigate(`/${type}/new`)}>
              Create one →
            </a>
          </div>
        ) : (
          <table className="table">
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
                          onClick={() => {
                            if (confirm(`Move ${d.docNumber} to Recycle Bin?`)) deleteDocument(d.id)
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
          </table>
        )}
      </div>
    </div>
  )
}
