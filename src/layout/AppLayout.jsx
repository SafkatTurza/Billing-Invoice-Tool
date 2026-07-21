import { useState, useMemo, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useFinance } from '../context/FinanceContext.jsx'
import { can, canAccessDocType, canSeeDocument } from '../lib/roles.js'
import { FIN_TYPES, isVoucherType, voucherLabel, voucherTotal } from '../lib/finance.js'
import { Icon } from '../components/Icons.jsx'
import { SessionExpiryBanner } from '../components/Banners.jsx'
import { formatMoney, formatDateTime } from '../lib/format.js'
import '../styles/layout.css'

// Sidebar groups mirror the original Paynox layout: Sales & Payments
// (Estimates before Invoices) and Purchases (PO/WO) + Money Receipt.
const SALES = [
  { type: 'estimates', label: 'Estimates', icon: Icon.estimate },
  { type: 'invoices', label: 'Invoices', icon: Icon.invoice },
]
const PURCHASES = [
  { type: 'purchase-orders', label: 'Purchase Orders', icon: Icon.po },
  { type: 'work-orders', label: 'Work Orders', icon: Icon.wo },
]

export default function AppLayout() {
  const { currentUser, docs } = useApp()
  const role = currentUser.role
  const [groups, setGroups] = useState({ sales: true, purchases: true, finance: true })
  const toggle = (id) => setGroups((g) => ({ ...g, [id]: !g[id] }))

  const liveDocs = docs.filter((d) => !d.deleted)
  const counts = useMemo(() => {
    const c = {}
    for (const d of liveDocs) {
      if (canSeeDocument(currentUser, d)) c[d.type] = (c[d.type] || 0) + 1
    }
    return c
  }, [liveDocs, currentUser])

  const NavDoc = ({ d, sub }) =>
    canAccessDocType(role, d.type) ? (
      <NavLink to={`/${d.type}`} className={`nav-item${sub ? ' sub' : ''}`}>
        <d.icon width={17} height={17} />
        {d.label}
        {counts[d.type] ? <span className="count">{counts[d.type]}</span> : null}
      </NavLink>
    ) : null

  const isBT = role === 'Business Team'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="mark">P</div>
          <div className="name">
            Paynox
            <span>© Paynox · by Safkat Turza</span>
          </div>
        </div>

        <nav className="nav-scroll">
          <NavLink to="/dashboard" className="nav-item">
            <Icon.dashboard width={17} height={17} />
            Dashboard
          </NavLink>

          <button className="nav-group-toggle" onClick={() => toggle('sales')}>
            <Icon.estimate width={16} height={16} />
            Sales &amp; Payments
            <span className={`arr${groups.sales ? ' open' : ''}`}>
              <Icon.chevron width={13} height={13} />
            </span>
          </button>
          {groups.sales && SALES.map((d) => <NavDoc key={d.type} d={d} sub />)}

          {!isBT && (
            <>
              <button className="nav-group-toggle" onClick={() => toggle('purchases')}>
                <Icon.po width={16} height={16} />
                Purchases
                <span className={`arr${groups.purchases ? ' open' : ''}`}>
                  <Icon.chevron width={13} height={13} />
                </span>
              </button>
              {groups.purchases && PURCHASES.map((d) => <NavDoc key={d.type} d={d} sub />)}
              <NavDoc d={{ type: 'money-receipt', label: 'Money Receipt', icon: Icon.receipt }} />
            </>
          )}

          {can(role, 'financeView') && (
            <>
              <button className="nav-group-toggle" onClick={() => toggle('finance')}>
                <Icon.money width={16} height={16} />
                Finance
                <span className={`arr${groups.finance ? ' open' : ''}`}>
                  <Icon.chevron width={13} height={13} />
                </span>
              </button>
              {groups.finance && (
                <>
                  <NavLink to="/finance" end className="nav-item sub">
                    <Icon.dashboard width={16} height={16} /> Overview
                  </NavLink>
                  <NavLink to="/finance/requisition" className="nav-item sub">
                    <Icon.invoice width={16} height={16} /> Requisitions
                  </NavLink>
                  <NavLink to="/finance/voucher" className="nav-item sub">
                    <Icon.money width={16} height={16} /> Vouchers
                  </NavLink>
                  <NavLink to="/finance/expenses" className="nav-item sub">
                    <Icon.po width={16} height={16} /> Daily Expenses
                  </NavLink>
                  <NavLink to="/finance/bills" className="nav-item sub">
                    <Icon.receipt width={16} height={16} /> Bills &amp; Payables
                  </NavLink>
                  <NavLink to="/finance/income" className="nav-item sub">
                    <Icon.money width={16} height={16} /> Income &amp; Investment
                  </NavLink>
                  <NavLink to="/finance/budgets" className="nav-item sub">
                    <Icon.estimate width={16} height={16} /> Budgets
                  </NavLink>
                  <NavLink to="/finance/recurring" className="nav-item sub">
                    <Icon.audit width={16} height={16} /> Recurring
                  </NavLink>
                  <NavLink to="/finance/employees" className="nav-item sub">
                    <Icon.users width={16} height={16} /> Employees
                  </NavLink>
                  <NavLink to="/finance/loans" className="nav-item sub">
                    <Icon.money width={16} height={16} /> Loans &amp; Advances
                  </NavLink>
                  <NavLink to="/finance/salary-sheet" className="nav-item sub">
                    <Icon.wo width={16} height={16} /> Salary Sheets
                  </NavLink>
                  <NavLink to="/finance/ledger" className="nav-item sub">
                    <Icon.audit width={16} height={16} /> Ledger
                  </NavLink>
                  <NavLink to="/finance/reports" className="nav-item sub">
                    <Icon.estimate width={16} height={16} /> Monthly Report
                  </NavLink>
                  <NavLink to="/finance/statements" className="nav-item sub">
                    <Icon.estimate width={16} height={16} /> Financial Reports
                  </NavLink>
                  <NavLink to="/finance/gl" className="nav-item sub">
                    <Icon.audit width={16} height={16} /> General Ledger
                  </NavLink>
                  <NavLink to="/finance/insights" className="nav-item sub">
                    <Icon.monitor width={16} height={16} /> Insights &amp; Forecast
                  </NavLink>
                </>
              )}
            </>
          )}

          {can(role, 'recycleBin') && (
            <NavLink to="/recycle-bin" className="nav-item">
              <Icon.trash width={17} height={17} />
              Recycle Bin
            </NavLink>
          )}

          <div className="nav-divider" />

          <NavLink to="/settings" className="nav-item">
            <Icon.settings width={17} height={17} />
            Settings
          </NavLink>
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="avatar">{initials(currentUser.fullName)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="u-name">{currentUser.fullName}</div>
              <div className="u-role">{currentUser.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <Topbar />
        <main className="content">
          <ExpiryWatcher />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Warns 5 minutes before a 30-day session expires (Addendum 17.3).
function ExpiryWatcher() {
  const { sessionExpiry, extendSession } = useApp()
  const [minutes, setMinutes] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!sessionExpiry) return
    const tick = () => {
      const left = sessionExpiry - Date.now()
      if (left <= 5 * 60 * 1000 && left > 0) setMinutes(Math.ceil(left / 60000))
      else setMinutes(null)
    }
    tick()
    const iv = setInterval(tick, 15000)
    return () => clearInterval(iv)
  }, [sessionExpiry])

  if (minutes == null || dismissed) return null
  return (
    <SessionExpiryBanner
      minutes={minutes}
      onExtend={() => {
        extendSession()
        setDismissed(false)
      }}
      onDismiss={() => setDismissed(true)}
    />
  )
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ── Top bar: global search + notifications + logout ──────────
function Topbar() {
  const { docs, currentUser, inAppNotifs, logout, markNotifRead, clearNotifs } = useApp()
  const { finDocs } = useFinance()
  const canFinance = can(currentUser.role, 'financeView')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const searchRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Global search across all doc types, respecting role visibility (24.2).
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return docs
      .filter((d) => !d.deleted)
      .filter((d) => canSeeDocument(currentUser, d))
      .filter((d) => {
        return (
          (d.docNumber || '').toLowerCase().includes(q) ||
          (d.partyName || '').toLowerCase().includes(q) ||
          (d.reference || '').toLowerCase().includes(q) ||
          String(d.grandTotal || '').includes(q)
        )
      })
      .slice(0, 30)
  }, [query, docs, currentUser])

  const grouped = useMemo(() => {
    const g = {}
    for (const d of results) (g[d.type] = g[d.type] || []).push(d)
    return g
  }, [results])

  // Finance documents — searchable for any role with finance visibility.
  const finResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !canFinance) return []
    return finDocs
      .filter((d) => !d.deleted)
      .filter(
        (d) =>
          (d.docNumber || '').toLowerCase().includes(q) ||
          (d.title || d.purpose || d.description || d.receivedFrom || d.party || d.vendorName || d.billRef || '')
            .toLowerCase()
            .includes(q) ||
          String(d.amount || d.total || '').includes(q),
      )
      .slice(0, 20)
  }, [query, finDocs, canFinance])

  const finGrouped = useMemo(() => {
    const g = {}
    for (const d of finResults) {
      const key = isVoucherType(d.type) ? 'voucher' : d.type
      ;(g[key] = g[key] || []).push(d)
    }
    return g
  }, [finResults])

  // Notifications visible to this user: addressed to them or (admin-only) broadcasts.
  const myNotifs = useMemo(() => {
    const isAdmin = ['Super Admin', 'Admin'].includes(currentUser.role)
    return inAppNotifs.filter((n) => n.toUserId === currentUser.id || (!n.toUserId && isAdmin))
  }, [inAppNotifs, currentUser])
  const unread = myNotifs.filter((n) => !n.read).length

  const openResult = (d) => {
    setQuery('')
    setShowResults(false)
    navigate(`/${d.type}/${d.id}`)
  }

  const openFinResult = (d) => {
    setQuery('')
    setShowResults(false)
    navigate(financeRouteFor(d))
  }

  return (
    <header className="topbar">
      <div className="global-search" ref={searchRef}>
        <span className="icon">
          <Icon.search width={17} height={17} />
        </span>
        <input
          placeholder="Search invoices, estimates, clients, amounts…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
        />
        {showResults && query.trim() && (
          <div className="search-results">
            {results.length === 0 && finResults.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                No documents match “{query}”.
              </div>
            ) : (
              <>
                {Object.entries(grouped).map(([type, list]) => (
                  <div key={type}>
                    <div className="search-group-label">{labelForType(type)}</div>
                    {list.map((d) => (
                      <div key={d.id} className="search-result" onClick={() => openResult(d)}>
                        <span className="sr-num mono">{d.docNumber}</span>
                        <span className="muted">{d.partyName || '—'}</span>
                        <span className="grow" />
                        <span className="small">{formatMoney(d.grandTotal, d.currency)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {Object.entries(finGrouped).map(([key, list]) => (
                  <div key={'fin-' + key}>
                    <div className="search-group-label">{finGroupLabel(key, list[0])}</div>
                    {list.map((d) => (
                      <div key={d.id} className="search-result" onClick={() => openFinResult(d)}>
                        <span className="sr-num mono">{d.docNumber}</span>
                        <span className="muted">{d.title || d.purpose || d.description || d.receivedFrom || d.party || d.vendorName || '—'}</span>
                        <span className="grow" />
                        <span className="small">{formatMoney(finRowAmount(d), d.currency)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="grow" />

      <div className="topbar-actions">
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button className="icon-btn" onClick={() => setShowNotifs((v) => !v)} aria-label="Notifications">
            <Icon.bell width={18} height={18} />
            {unread > 0 && <span className="dot-badge">{unread}</span>}
          </button>
          {showNotifs && (
            <div className="notif-panel">
              <div className="np-head">
                <span>Notifications</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => clearNotifs(currentUser.id)}
                >
                  Clear all
                </button>
              </div>
              <div className="notif-list">
                {myNotifs.length === 0 ? (
                  <div className="empty" style={{ padding: 30 }}>
                    You're all caught up.
                  </div>
                ) : (
                  myNotifs.slice(0, 40).map((n) => (
                    <div
                      key={n.id}
                      className={`notif-row ${n.read ? '' : 'unread'}`}
                      onClick={() => {
                        markNotifRead(n.id)
                        if (n.link) {
                          setShowNotifs(false)
                          navigate(n.link)
                        }
                      }}
                    >
                      {!n.read && <span className="nr-dot" />}
                      <div>
                        <div className="nr-msg">{n.message}</div>
                        <div className="nr-time">{formatDateTime(n.time)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
          <Icon.logout width={18} height={18} />
        </button>
      </div>
    </header>
  )
}

function labelForType(type) {
  return (
    {
      invoices: 'Invoices',
      estimates: 'Estimates',
      'purchase-orders': 'Purchase Orders',
      'work-orders': 'Work Orders',
      'money-receipt': 'Money Receipts',
    }[type] || type
  )
}

// Where a finance document opens from a global-search hit.
function financeRouteFor(d) {
  if (isVoucherType(d.type)) return `/finance/voucher/${d.id}`
  if (d.type === 'requisition') return `/finance/requisition/${d.id}`
  if (d.type === 'income') return `/finance/income/${d.id}`
  if (d.type === 'salary-sheet') return `/finance/salary-sheet/${d.id}`
  if (d.type === 'expense') return '/finance/expenses'
  if (d.type === 'bill') return '/finance/bills'
  return '/finance'
}
function finGroupLabel(key, sample) {
  if (key === 'voucher') return 'Vouchers'
  return FIN_TYPES[key]?.plural || voucherLabel(sample)
}
function finRowAmount(d) {
  return isVoucherType(d.type) ? voucherTotal(d) : Number(d.amount) || Number(d.total) || 0
}
