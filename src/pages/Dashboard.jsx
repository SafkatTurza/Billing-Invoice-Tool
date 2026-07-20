import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { can, canAccessDocType, canSeeDocument } from '../lib/roles.js'
import { formatMoney, formatDate } from '../lib/format.js'
import { Icon } from '../components/Icons.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import '../styles/dashboard.css'

const CARD_META = [
  { type: 'invoices', label: 'Invoices', icon: Icon.invoice, color: '#2563eb' },
  { type: 'estimates', label: 'Estimates', icon: Icon.estimate, color: '#0d9488' },
  { type: 'purchase-orders', label: 'Purchase Orders', icon: Icon.po, color: '#7c3aed' },
  { type: 'money-receipt', label: 'Money Receipts', icon: Icon.receipt, color: '#d97706' },
]

const QUICK = [
  { type: 'invoices', label: 'New Invoice', icon: Icon.invoice },
  { type: 'estimates', label: 'New Estimate', icon: Icon.estimate },
  { type: 'purchase-orders', label: 'New PO', icon: Icon.po },
  { type: 'work-orders', label: 'New WO', icon: Icon.wo },
  { type: 'money-receipt', label: 'New Receipt', icon: Icon.receipt },
]

// Group amounts by currency (SRS 7.2 — never mixed or converted).
function sumByCurrency(list, pick) {
  const out = {}
  for (const d of list) {
    const v = pick(d)
    if (v == null) continue
    out[d.currency] = (out[d.currency] || 0) + (Number(v) || 0)
  }
  return out
}

function CurrencyLines({ map, className }) {
  const entries = Object.entries(map)
  if (entries.length === 0) return <span className="muted">—</span>
  return (
    <>
      {entries.map(([cur, amt]) => (
        <span key={cur} className={className} style={{ display: 'block' }}>
          {formatMoney(amt, cur)}
        </span>
      ))}
    </>
  )
}

export default function Dashboard() {
  const { docs, currentUser } = useApp()
  const navigate = useNavigate()
  const role = currentUser.role

  const visible = useMemo(
    () => docs.filter((d) => !d.deleted && canSeeDocument(currentUser, d)),
    [docs, currentUser],
  )

  const counts = useMemo(() => {
    const c = {}
    for (const d of visible) c[d.type] = (c[d.type] || 0) + 1
    return c
  }, [visible])

  const invoices = visible.filter((d) => d.type === 'invoices')
  const pos = visible.filter((d) => d.type === 'purchase-orders')
  const wos = visible.filter((d) => d.type === 'work-orders')
  const receipts = visible.filter((d) => d.type === 'money-receipt')

  const totalInvoiced = sumByCurrency(invoices, (d) => d.grandTotal)
  const totalPaid = sumByCurrency(
    invoices.filter((d) => d.status === 'Paid'),
    (d) => d.grandTotal,
  )
  const totalSpent = sumByCurrency([...pos, ...wos], (d) => d.grandTotal)
  const totalReceived = sumByCurrency(receipts, (d) => d.receivedAmount ?? d.grandTotal)

  const recent = useMemo(
    () =>
      [...visible]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6),
    [visible],
  )

  const showRevenue = can(role, 'viewRevenue')

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">
        Welcome back, {currentUser.fullName.split(' ')[0]}. Here's your billing overview.
      </p>

      {/* Count cards */}
      <div className="dash-cards mt-24">
        {CARD_META.filter((c) => canAccessDocType(role, c.type)).map((c) => (
          <div key={c.type} className="count-card" onClick={() => navigate(`/${c.type}`)}>
            <div className="cc-top">
              <span className="cc-label" style={{ margin: 0 }}>
                {c.label}
              </span>
              <div className="cc-icon" style={{ background: c.color }}>
                <c.icon width={20} height={20} />
              </div>
            </div>
            <div className="cc-num">{counts[c.type] || 0}</div>
            <div className="cc-label">Total documents</div>
          </div>
        ))}
      </div>

      {/* Financial summary — hidden for Business Team */}
      {showRevenue && (
        <>
          <div className="section-head">
            <h3>Financial Summary</h3>
            <span className="small muted">Grouped by currency — never mixed or converted</span>
          </div>
          <div className="fin-grid">
            <div className="fin-card">
              <h4>Revenue In (Invoices)</h4>
              <div className="fc-sub">All invoices vs. paid</div>
              <div className="fin-line">
                <span className="fl-label">Total Invoiced</span>
                <span className="fl-val">
                  <CurrencyLines map={totalInvoiced} />
                </span>
              </div>
              <div className="fin-line">
                <span className="fl-label">Total Paid</span>
                <span className="fl-val green">
                  <CurrencyLines map={totalPaid} className="green" />
                </span>
              </div>
            </div>

            <div className="fin-card">
              <h4>Spent (PO + WO)</h4>
              <div className="fc-sub">
                {pos.length} POs · {wos.length} WOs
              </div>
              <div className="fin-line">
                <span className="fl-label">Total Committed</span>
                <span className="fl-val">
                  <CurrencyLines map={totalSpent} />
                </span>
              </div>
            </div>

            <div className="fin-card">
              <h4>Money Receipts</h4>
              <div className="fc-sub">{receipts.length} receipts issued</div>
              <div className="fin-line">
                <span className="fl-label">Total Received</span>
                <span className="fl-val">
                  <CurrencyLines map={totalReceived} />
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quick create */}
      <div className="section-head">
        <h3>Quick Create</h3>
      </div>
      <div className="quick-create">
        {QUICK.filter((q) => canAccessDocType(role, q.type)).map((q) => (
          <button key={q.type} className="qc-btn" onClick={() => navigate(`/${q.type}/new`)}>
            <span className="qc-icon">
              <q.icon width={18} height={18} />
            </span>
            {q.label}
          </button>
        ))}
      </div>

      {/* Recent documents */}
      <div className="section-head">
        <h3>Recent Documents</h3>
      </div>
      <div className="card">
        {recent.length === 0 ? (
          <div className="empty">No documents yet. Use Quick Create to get started.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Party</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/${d.type}/${d.id}`)}>
                  <td className="mono bold">{d.docNumber}</td>
                  <td>{typeLabel(d.type)}</td>
                  <td>{d.partyName || '—'}</td>
                  <td className="text-right nowrap">{formatMoney(d.grandTotal, d.currency)}</td>
                  <td>
                    <StatusBadge status={d.status} />
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

function typeLabel(type) {
  return (
    {
      invoices: 'Invoice',
      estimates: 'Estimate',
      'purchase-orders': 'Purchase Order',
      'work-orders': 'Work Order',
      'money-receipt': 'Money Receipt',
    }[type] || type
  )
}
