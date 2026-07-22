import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { isVoucherType, isPrimary, voucherLabel, voucherTotal, voucherDirection } from '../../lib/finance.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/documents.css'

// One real-world transaction can be documented by several vouchers, but only the
// primary posts to the ledger. This view groups every document + ledger entry
// that shares a Transaction ID so the single financial impact is auditable.
export default function TransactionDetail() {
  const { txnId } = useParams()
  const navigate = useNavigate()
  const { finDocs, ledger } = useFinance()
  const id = decodeURIComponent(txnId || '')

  const docs = useMemo(
    () =>
      finDocs
        .filter((d) => isVoucherType(d.type) && d.transactionId === id && !d.deleted)
        .sort((a, b) => (isPrimary(b) ? 1 : 0) - (isPrimary(a) ? 1 : 0)),
    [finDocs, id],
  )
  const txns = useMemo(() => ledger.filter((t) => t.transactionId === id && t.status === 'posted'), [ledger, id])

  const primary = docs.find((d) => isPrimary(d))
  const linked = docs.filter((d) => !isPrimary(d))
  const posted = txns.reduce((s, t) => s + (Number(t.amount) || 0), 0)

  const goDoc = (d) => navigate(`/finance/voucher/${d.id}`)

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">Transaction Detail</h1>
          <p className="page-sub mono">{id}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/finance/voucher')}>
          Back to Vouchers
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="card mt-24">
          <div className="empty">No documents found for this transaction.</div>
        </div>
      ) : (
        <>
          {/* Financial-impact summary — one entry, no double counting. */}
          <div className="card card-pad mt-24">
            <div className="row between center wrap" style={{ gap: 12 }}>
              <div>
                <div className="small muted">Recorded financial impact</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {primary ? formatMoney(posted || voucherTotal(primary), primary.currency) : formatMoney(posted, 'BDT')}
                </div>
                <div className="small muted">
                  {txns.length} ledger entr{txns.length === 1 ? 'y' : 'ies'} · {docs.length} document{docs.length === 1 ? '' : 's'} in this transaction
                  {linked.length > 0 && ` (${linked.length} linked, no additional impact)`}
                </div>
              </div>
              <span className={`badge ${txns.length ? 'badge-green' : 'badge-amber'}`}>
                {txns.length ? 'Posted to ledger' : 'Not yet posted'}
              </span>
            </div>
          </div>

          {/* Primary document */}
          {primary && (
            <div className="card mt-24">
              <div className="card-pad" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Primary Transaction</h3>
                <p className="small muted" style={{ margin: '4px 0 0' }}>This document records the financial transaction to the ledger.</p>
              </div>
              <div className="table-scroll"><table className="table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Details</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <DocRow d={primary} onView={goDoc} />
                </tbody>
              </table></div>
            </div>
          )}

          {/* Linked / internal records */}
          {linked.length > 0 && (
            <div className="card mt-24">
              <div className="card-pad" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Linked / Internal Records</h3>
                <p className="small muted" style={{ margin: '4px 0 0' }}>Documentation only — these add no further ledger impact.</p>
              </div>
              <div className="table-scroll"><table className="table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Details</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {linked.map((d) => (
                    <DocRow key={d.id} d={d} onView={goDoc} linked />
                  ))}
                </tbody>
              </table></div>
            </div>
          )}

          {/* Ledger entries */}
          <div className="card mt-24">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Ledger Entries</h3>
            </div>
            {txns.length === 0 ? (
              <div className="empty">No posted ledger entries for this transaction yet.</div>
            ) : (
              <div className="table-scroll"><table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Direction</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => (
                    <tr key={t.id}>
                      <td className="small nowrap">{formatDate(t.txnDate)}</td>
                      <td>{t.description || '—'}</td>
                      <td>
                        <span className={t.direction === 'in' ? 'ledger-in' : 'ledger-out'}>{t.direction === 'in' ? 'In' : 'Out'}</span>
                      </td>
                      <td className="text-right nowrap">{formatMoney(Number(t.amount) || 0, t.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function DocRow({ d, onView, linked }) {
  const badgeClass = d.voucherType === 'cash' ? 'badge-green' : d.voucherType === 'debit' ? 'badge-teal' : 'badge-blue'
  return (
    <tr>
      <td className="mono bold" style={{ cursor: 'pointer' }} onClick={() => onView(d)}>
        {d.docNumber}
      </td>
      <td>
        <span className={`badge ${badgeClass}`}>{voucherLabel(d).replace(' Voucher', '')}</span>
        {d.voucherType === 'cash' && (
          <span className="small muted" style={{ marginLeft: 6 }}>{voucherDirection(d) === 'in' ? 'Receipt' : 'Payment'}</span>
        )}
      </td>
      <td className="small nowrap">{formatDate(d.date)}</td>
      <td>{d.purpose || d.receivedFrom || '—'}</td>
      <td className="text-right nowrap">{formatMoney(voucherTotal(d), d.currency)}</td>
      <td>
        {linked ? <span className="badge badge-gray">No impact</span> : <span className="badge badge-green">Ledger</span>}
      </td>
      <td className="text-right">
        <button className="btn btn-ghost btn-sm" onClick={() => onView(d)} title="View">
          <Icon.eye width={14} height={14} />
        </button>
      </td>
    </tr>
  )
}
