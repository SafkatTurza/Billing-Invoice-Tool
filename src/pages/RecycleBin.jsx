import { useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { formatDate, formatMoney } from '../lib/format.js'
import { Icon } from '../components/Icons.jsx'

const RETENTION_DAYS = 30

export default function RecycleBin() {
  const { docs, restoreDocument, permanentDelete } = useApp()
  const toast = useToast()

  const deleted = useMemo(() => docs.filter((d) => d.deleted), [docs])

  const daysRemaining = (deletedAt) => {
    const elapsed = (Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed))
  }

  return (
    <div>
      <h1 className="page-title">Recycle Bin</h1>
      <p className="page-sub">Deleted documents are kept for {RETENTION_DAYS} days before permanent removal.</p>

      <div className="card mt-24">
        {deleted.length === 0 ? (
          <div className="empty">Recycle Bin is empty.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Party</th>
                <th className="text-right">Amount</th>
                <th>Deleted By</th>
                <th>Date Deleted</th>
                <th>Days Left</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deleted.map((d) => {
                const left = daysRemaining(d.deletedAt)
                return (
                  <tr key={d.id}>
                    <td className="mono bold">{d.docNumber}</td>
                    <td>{d.type}</td>
                    <td>{d.partyName || '—'}</td>
                    <td className="text-right nowrap">{formatMoney(d.grandTotal, d.currency)}</td>
                    <td className="small muted">{d.deletedBy || '—'}</td>
                    <td className="small">{formatDate(d.deletedAt)}</td>
                    <td>
                      <span className={`badge ${left <= 5 ? 'badge-red' : 'badge-amber'}`}>{left} days</span>
                    </td>
                    <td className="text-right nowrap">
                      <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            restoreDocument(d.id)
                            toast.success('Document restored.')
                          }}
                        >
                          Restore
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (confirm('Permanently delete this document? This cannot be undone.')) {
                              permanentDelete(d.id)
                              toast.success('Permanently deleted.')
                            }
                          }}
                        >
                          <Icon.trash width={14} height={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
