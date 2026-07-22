import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
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

// Finance sub-groups: three buckets so the module reads at a glance instead of
// a flat 16-item list. Overview stays pinned above these. Order within each
// bucket is kept intact so nothing feels relocated.
const FIN_TRANSACTIONS = [
  { to: '/finance/requisition', label: 'Requisitions', icon: Icon.invoice },
  { to: '/finance/voucher', label: 'Vouchers', icon: Icon.money },
  { to: '/finance/expenses', label: 'Daily Expenses', icon: Icon.po },
  { to: '/finance/bills', label: 'Bills & Payables', icon: Icon.receipt },
  { to: '/finance/income', label: 'Income & Investment', icon: Icon.money },
  { to: '/finance/recurring', label: 'Recurring', icon: Icon.audit },
]
const FIN_PAYROLL = [
  { to: '/finance/employees', label: 'Employees', icon: Icon.users },
  { to: '/finance/salary-sheet', label: 'Salary Sheets', icon: Icon.wo },
  { to: '/finance/loans', label: 'Loans & Advances', icon: Icon.money },
]
// "Ledgers" (the books) split out from analytical reports so neither bucket
// gets too long — one nesting level, no items moved out of Finance.
const FIN_LEDGERS = [
  { to: '/finance/ledger', label: 'Ledger', icon: Icon.audit },
  { to: '/finance/gl', label: 'General Ledger', icon: Icon.audit },
]
const FIN_REPORTS = [
  { to: '/finance/budgets', label: 'Budgets', icon: Icon.estimate },
  { to: '/finance/reports', label: 'Monthly Report', icon: Icon.estimate },
  { to: '/finance/statements', label: 'Financial Reports', icon: Icon.estimate },
  { to: '/finance/insights', label: 'Insights & Forecast', icon: Icon.monitor },
]

// Each Finance sub-group paired with its collapse-state key — used to
// force-expand the group that contains the active route.
const FIN_GROUPS = [
  ['finTxn', FIN_TRANSACTIONS],
  ['finPayroll', FIN_PAYROLL],
  ['finLedgers', FIN_LEDGERS],
  ['finReports', FIN_REPORTS],
]
const pathInItems = (pathname, items) =>
  items.some((it) => pathname === it.to || pathname.startsWith(it.to + '/'))

// Hoisted to module scope on purpose. Defining these inside AppLayout made them
// a new component type on every render, so React unmounted & remounted the nav
// subtree on each navigation — which collapsed the scroll container and reset
// the sidebar's scroll position. As stable types, navigation only patches the
// active class in place and the scroll position is preserved for free.
function NavDoc({ d, sub, role, counts }) {
  if (!canAccessDocType(role, d.type)) return null
  return (
    <NavLink to={`/${d.type}`} className={`nav-item${sub ? ' sub' : ''}`}>
      <d.icon width={17} height={17} />
      {d.label}
      {counts[d.type] ? <span className="count">{counts[d.type]}</span> : null}
    </NavLink>
  )
}

function FinSub({ id, label, items, open, onToggle }) {
  return (
    <>
      <button className="nav-group-toggle sub" onClick={() => onToggle(id)}>
        {label}
        <span className={`arr${open ? ' open' : ''}`}>
          <Icon.chevron width={12} height={12} />
        </span>
      </button>
      {open &&
        items.map((it) => (
          <NavLink key={it.to} to={it.to} className="nav-item sub2">
            <it.icon width={16} height={16} /> {it.label}
          </NavLink>
        ))}
    </>
  )
}

export default function AppLayout() {
  const { currentUser, docs } = useApp()
  const role = currentUser.role
  const location = useLocation()
  const navScrollRef = useRef(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [groups, setGroups] = useState({
    sales: true,
    purchases: true,
    finance: true,
    finTxn: true,
    finPayroll: true,
    finLedgers: true,
    finReports: true,
  })
  const toggle = useCallback((id) => setGroups((g) => ({ ...g, [id]: !g[id] })), [])

  // Close the mobile drawer whenever the route changes (a nav item was picked).
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Keep the Finance sub-group that owns the active route expanded (so it's
  // visible on deep-link / refresh, and re-opens when navigating into it). Runs
  // only on route change, so a user's manual collapse otherwise sticks.
  useEffect(() => {
    const hit = FIN_GROUPS.find(([, items]) => pathInItems(location.pathname, items))
    if (hit) setGroups((g) => (g[hit[0]] && g.finance ? g : { ...g, finance: true, [hit[0]]: true }))
  }, [location.pathname])

  // Bring the active item into view *only if it isn't already visible*, and
  // only within the sidebar's own scroll container — never the page. Used on
  // first mount (deep-link / refresh) and when the mobile drawer opens, not on
  // ordinary navigation, so an existing scroll position is preserved.
  const ensureActiveVisible = useCallback(() => {
    const c = navScrollRef.current
    if (!c) return
    const active = c.querySelector('.nav-item.active')
    if (!active) return
    const cRect = c.getBoundingClientRect()
    const aRect = active.getBoundingClientRect()
    if (aRect.top < cRect.top) c.scrollTop -= cRect.top - aRect.top + 8
    else if (aRect.bottom > cRect.bottom) c.scrollTop += aRect.bottom - cRect.bottom + 8
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { requestAnimationFrame(ensureActiveVisible) }, []) // once, on load
  useEffect(() => {
    if (drawerOpen) requestAnimationFrame(ensureActiveVisible)
  }, [drawerOpen, ensureActiveVisible])

  // While the drawer is open: lock background scroll and close on Escape.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  const liveDocs = docs.filter((d) => !d.deleted)
  const counts = useMemo(() => {
    const c = {}
    for (const d of liveDocs) {
      if (canSeeDocument(currentUser, d)) c[d.type] = (c[d.type] || 0) + 1
    }
    return c
  }, [liveDocs, currentUser])

  const isBT = role === 'Business Team'

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay${drawerOpen ? ' show' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside className={`sidebar${drawerOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="mark">P</div>
          <div className="name">
            Paynox
            <span>© Paynox · by Safkat Turza</span>
          </div>
          <button
            className="drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <Icon.x width={18} height={18} />
          </button>
        </div>

        <nav className="nav-scroll" ref={navScrollRef} onClick={(e) => { if (e.target.closest('a')) setDrawerOpen(false) }}>
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
          {groups.sales && SALES.map((d) => <NavDoc key={d.type} d={d} sub role={role} counts={counts} />)}

          {!isBT && (
            <>
              <button className="nav-group-toggle" onClick={() => toggle('purchases')}>
                <Icon.po width={16} height={16} />
                Purchases
                <span className={`arr${groups.purchases ? ' open' : ''}`}>
                  <Icon.chevron width={13} height={13} />
                </span>
              </button>
              {groups.purchases && PURCHASES.map((d) => <NavDoc key={d.type} d={d} sub role={role} counts={counts} />)}
              <NavDoc d={{ type: 'money-receipt', label: 'Money Receipt', icon: Icon.receipt }} role={role} counts={counts} />
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
                  <FinSub id="finTxn" label="Transactions" items={FIN_TRANSACTIONS} open={groups.finTxn} onToggle={toggle} />
                  <FinSub id="finPayroll" label="Payroll &amp; People" items={FIN_PAYROLL} open={groups.finPayroll} onToggle={toggle} />
                  <FinSub id="finLedgers" label="Ledgers" items={FIN_LEDGERS} open={groups.finLedgers} onToggle={toggle} />
                  <FinSub id="finReports" label="Reports &amp; Analysis" items={FIN_REPORTS} open={groups.finReports} onToggle={toggle} />
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
        <Topbar onMenu={() => setDrawerOpen(true)} />
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
function Topbar({ onMenu }) {
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
      <button className="nav-menu-btn" onClick={onMenu} aria-label="Open menu">
        <Icon.menu width={20} height={20} />
      </button>
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
