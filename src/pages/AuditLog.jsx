import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { formatDateTime } from '../lib/format.js'
import { Icon } from '../components/Icons.jsx'

export default function AuditLog() {
  const { auditLog } = useApp()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return auditLog
    return auditLog.filter(
      (e) =>
        e.user.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.target || '').toLowerCase().includes(q) ||
        (e.details || '').toLowerCase().includes(q),
    )
  }, [auditLog, query])

  return (
    <div>
      <h1 className="page-title">Audit Log</h1>
      <p className="page-sub">Every significant action in the system. Visible to Admin & Super Admin only.</p>

      <div className="card mt-24">
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <div className="global-search" style={{ maxWidth: 360 }}>
            <span className="icon">
              <Icon.search width={16} height={16} />
            </span>
            <input placeholder="Search log…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">No audit entries.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="small nowrap mono">{formatDateTime(e.timestamp)}</td>
                  <td className="small">{e.user}</td>
                  <td className="small bold">{e.action}</td>
                  <td className="small mono">{e.target || '—'}</td>
                  <td className="small muted">{e.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
