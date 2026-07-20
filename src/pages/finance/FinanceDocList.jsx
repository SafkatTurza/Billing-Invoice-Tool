import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { FIN_TYPES, FIN_STATUS } from '../../lib/finance.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/documents.css'

const STATUS_BADGE = {
  [FIN_STATUS.DRAFT]: 'badge-gray',
  [FIN_STATUS.PENDING]: 'badge-amber',
  [FIN_STATUS.APPROVED]: 'badge-green',
  [FIN_STATUS.REJECTED]: 'badge-red',
  [FIN_STATUS.RECORDED]: 'badge-teal',
}

export default function FinanceDocList({ type }) {
  const { finDocs, deleteFinDoc } = useFinance()
  const { currentUser } = useApp()
  const navigate = useNavigate()
  const meta = FIN_TYPES[type]

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return finDocs
      .filter((d) => d.type === type && !d.deleted)
      .filter((d) => statusFilter === 'all' || d.status === statusFilter)
      .filter(
        (d) =>
          !q ||
          (d.docNumber || '').toLowerCase().includes(q) ||
          (d.title || d.purpose || d.receivedFrom || '').toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [finDocs, type, query, statusFilter])

  const amountOf = (d) => Number(d.amount) || Number(d.total) || 0
  const canManage = can(currentUser.role, 'financeManage')

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">{meta.plural}</h1>
          <p className="page-sub">{rows.length} document{rows.length === 1 ? '' : 's'}</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => navigate(`/finance/${type}/new`)}>
            <Icon.plus width={16} height={16} /> New {meta.label}
          </button>
        )}
      </div>

      <div className="card mt-24">
        <div className="list-toolbar">
          <div className="global-search">
            <span className="icon">
              <Icon.search width={16} height={16} />
            </span>
            <input placeholder={`Search ${meta.plural.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="select" style={{ width: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {Object.values(FIN_STATUS).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            No {meta.plural.toLowerCase()} yet.
            {canManage && (
              <>
                {' '}
                <a style={{ color: 'var(--navy)', fontWeight: 600 }} onClick={() => navigate(`/finance/${type}/new`)}>
                  Create one →
                </a>
              </>
            )}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Details</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="mono bold" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/${type}/${d.id}`)}>
                    {d.docNumber}
                  </td>
                  <td className="small nowrap">{formatDate(d.date)}</td>
                  <td>{d.title || d.purpose || d.receivedFrom || '—'}</td>
                  <td className="text-right nowrap">{formatMoney(amountOf(d), d.currency)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[d.status] || 'badge-gray'}`}>{d.status}</span>
                  </td>
                  <td className="text-right nowrap">
                    <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/finance/${type}/${d.id}`)} title="View">
                        <Icon.eye width={14} height={14} />
                      </button>
                      {canManage && d.status === FIN_STATUS.DRAFT && (
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/finance/${type}/${d.id}/edit`)} title="Edit">
                          <Icon.edit width={14} height={14} />
                        </button>
                      )}
                      {can(currentUser.role, 'manageFinanceMasters') && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => confirm(`Delete ${d.docNumber}?`) && deleteFinDoc(d.id)}
                          title="Delete"
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
