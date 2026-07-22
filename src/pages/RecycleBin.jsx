import { useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useFinance } from '../context/FinanceContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { formatDate, formatMoney } from '../lib/format.js'
import { FIN_TYPES, voucherTotal, isVoucherType, voucherLabel } from '../lib/finance.js'
import { Icon } from '../components/Icons.jsx'

const RETENTION_DAYS = 30

export default function RecycleBin() {
  const { docs, restoreDocument, permanentDelete } = useApp()
  const { finDocs, restoreFinDoc, permanentDeleteFinDoc } = useFinance()
  const toast = useToast()

  const deleted = useMemo(() => docs.filter((d) => d.deleted), [docs])
  const finDeleted = useMemo(() => finDocs.filter((d) => d.deleted), [finDocs])

  const finAmount = (d) => (isVoucherType(d.type) ? voucherTotal(d) : Number(d.amount) || Number(d.total) || 0)
  const finTypeLabel = (d) => (isVoucherType(d.type) ? voucherLabel(d) : FIN_TYPES[d.type]?.label || d.type)

  const daysRemaining = (deletedAt) => {
    const elapsed = (Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed))
  }

  return (
    <div>
      <h1 className="page-title">Recycle Bin</h1>
      <p className="page-sub">Deleted documents are kept for {RETENTION_DAYS} days before permanent removal.</p>

      {finDeleted.length > 0 && <h3 className="section-title mt-24" style={{ fontSize: 15, color: 'var(--navy)' }}>Billing Documents</h3>}
      <div className="card mt-24">
        {deleted.length === 0 ? (
          <div className="empty">Recycle Bin is empty.</div>
        ) : (
          <div className="table-scroll"><table className="table">
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
          </table></div>
        )}
      </div>

      {/* Finance documents (requisitions, vouchers, expenses, income, salary) */}
      {finDeleted.length > 0 && (
        <>
          <h3 className="section-title mt-24" style={{ fontSize: 15, color: 'var(--navy)' }}>Finance Documents</h3>
          <div className="card mt-16">
            <div className="table-scroll"><table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th className="text-right">Amount</th>
                  <th>Deleted By</th>
                  <th>Date Deleted</th>
                  <th>Days Left</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {finDeleted.map((d) => {
                  const left = daysRemaining(d.deletedAt)
                  return (
                    <tr key={d.id}>
                      <td className="mono bold">{d.docNumber}</td>
                      <td>{finTypeLabel(d)}</td>
                      <td>{d.title || d.purpose || d.description || d.receivedFrom || '—'}</td>
                      <td className="text-right nowrap">{formatMoney(finAmount(d), d.currency)}</td>
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
                              restoreFinDoc(d.id)
                              toast.success('Finance document restored.')
                            }}
                          >
                            Restore
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (confirm('Permanently delete this finance document? This cannot be undone.')) {
                                permanentDeleteFinDoc(d.id)
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
            </table></div>
          </div>
        </>
      )}
    </div>
  )
}
