import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useFinance } from '../context/FinanceContext.jsx'
import { useAssets } from '../context/AssetContext.jsx'
import { custodianLabel } from '../lib/assets.js'
import { can, canAccessDocType, canSeeDocument } from '../lib/roles.js'
import { FIN_TYPES, isVoucherType, voucherLabel, voucherTotal } from '../lib/finance.js'
import { Icon } from '../components/Icons.jsx'
import { SessionExpiryBanner } from '../components/Banners.jsx'
import { formatMoney, formatDateTime } from '../lib/format.js'
import '../styles/layout.css'

// ── Single-open accordion navigation (spec §6) ──────────────────
// Major modules are collapsed by default; only the group owning the active
// route opens. The former 3-level Finance nesting (module → subcategory →
// item) is flattened into clean top-level groups so users see every module
// at a glance without a wall of submenus. Routes & permissions are unchanged;
// only the grouping in the sidebar changed. Doc-type items carry `docType`
// (per-item role gate + live count); finance/asset items are route-only and
// inherit the group's `perm` gate.
const NAV_GROUPS = [
  {
    id: 'sales',
    label: 'Sales & Payments',
    icon: Icon.invoice,
    items: [
      { to: '/estimates', label: 'Estimates', docType: 'estimates' },
      { to: '/invoices', label: 'Invoices', docType: 'invoices' },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    icon: Icon.po,
    items: [
      { to: '/purchase-orders', label: 'Purchase Orders', docType: 'purchase-orders' },
      { to: '/work-orders', label: 'Work Orders', docType: 'work-orders' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Icon.money,
    perm: 'financeView',
    items: [
      { to: '/finance', label: 'Overview', end: true },
      { to: '/finance/requisition', label: 'Requisitions' },
      { to: '/finance/voucher', label: 'Vouchers' },
      { to: '/finance/expenses', label: 'Daily Expenses' },
      { to: '/finance/bills', label: 'Bills & Payables' },
      { to: '/finance/income', label: 'Income & Investment' },
      { to: '/finance/recurring', label: 'Recurring' },
      { to: '/finance/ledger', label: 'Ledger' },
      { to: '/finance/gl', label: 'General Ledger' },
    ],
  },
  {
    id: 'payroll',
    label: 'Payroll & People',
    icon: Icon.users,
    perm: 'financeView',
    items: [
      { to: '/finance/employees', label: 'Employees' },
      { to: '/finance/salary-sheet', label: 'Salary Sheets' },
      { to: '/finance/loans', label: 'Loans & Advances' },
    ],
  },
  {
    id: 'assets',
    label: 'Asset Management',
    icon: Icon.monitor,
    perm: 'assetView',
    items: [
      { to: '/assets', label: 'Dashboard', end: true },
      { to: '/assets/register', label: 'Asset Register' },
      { to: '/assets/reports', label: 'Reports' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: Icon.estimate,
    perm: 'financeView',
    items: [
      { to: '/finance/budgets', label: 'Budgets' },
      { to: '/finance/reports', label: 'Monthly Report' },
      { to: '/finance/statements', label: 'Financial Reports' },
      { to: '/finance/insights', label: 'Insights & Forecast' },
    ],
  },
]

// Items a role may see within a group (doc-type items honour canAccessDocType).
function visibleItems(group, role) {
  return group.items.filter((it) => !it.docType || canAccessDocType(role, it.docType))
}
// A group renders only when its perm passes and it has at least one visible item.
function groupVisible(group, role) {
  if (group.perm && !can(role, group.perm)) return false
  return visibleItems(group, role).length > 0
}
// The group that owns the active route = longest matching item path. Using
// longest-prefix (not `end`) resolves the /finance vs /finance/employees
// overlap: Payroll's exact item beats Finance's shorter Overview prefix.
function findActiveGroup(pathname) {
  let bestId = null
  let bestLen = -1
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if ((pathname === it.to || pathname.startsWith(it.to + '/')) && it.to.length > bestLen) {
        bestLen = it.to.length
        bestId = g.id
      }
    }
  }
  return bestId
}

// Hoisted to module scope on purpose. Defining these inside AppLayout made them
// a new component type on every render, so React unmounted & remounted the nav
// subtree on each navigation — which collapsed the scroll container and reset
// the sidebar's scroll position. As stable types, navigation only patches the
// active class in place and the scroll position is preserved for free.
function NavGroup({ group, role, counts, open, active, onToggle }) {
  const items = visibleItems(group, role)
  return (
    <div className={`nav-group-block${active ? ' has-active' : ''}`}>
      <button
        className={`nav-group-toggle${open ? ' open' : ''}${active ? ' active' : ''}`}
        onClick={() => onToggle(group.id)}
        aria-expanded={open}
      >
        <group.icon width={18} height={18} />
        <span className="ngt-label">{group.label}</span>
        <span className={`arr${open ? ' open' : ''}`}>
          <Icon.chevron width={14} height={14} />
        </span>
      </button>
      {open && (
        <div className="nav-group-items">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className="nav-item sub">
              <span className="ni-dot" />
              <span className="ni-label">{it.label}</span>
              {it.docType && counts[it.docType] ? (
                <span className="count">{counts[it.docType]}</span>
              ) : null}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const { currentUser, docs } = useApp()
  const role = currentUser.role
  const location = useLocation()
  const navScrollRef = useRef(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Single-open accordion: at most one top-level group is expanded. Seeded to
  // the group owning the current route so a deep-link / refresh lands with the
  // right module open (spec §6).
  const activeGroup = findActiveGroup(location.pathname)
  const [openGroup, setOpenGroup] = useState(activeGroup)
  // Opening a group collapses whichever was open; clicking the open one closes it.
  const toggle = useCallback((id) => setOpenGroup((cur) => (cur === id ? null : id)), [])

  // Close the mobile drawer whenever the route changes (a nav item was picked).
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Keep the group that owns the active route expanded (visible on deep-link /
  // refresh, and re-opens when navigating into it). Standalone routes (Dashboard
  // / Settings) own no group, so the current expansion is left untouched.
  useEffect(() => {
    const g = findActiveGroup(location.pathname)
    if (g) setOpenGroup(g)
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
          <NavLink to="/dashboard" className="nav-item standalone">
            <Icon.dashboard width={18} height={18} />
            <span className="ni-label">Dashboard</span>
          </NavLink>

          {NAV_GROUPS.filter((g) => groupVisible(g, role)).map((g) => (
            <NavGroup
              key={g.id}
              group={g}
              role={role}
              counts={counts}
              open={openGroup === g.id}
              active={activeGroup === g.id}
              onToggle={toggle}
            />
          ))}

          {canAccessDocType(role, 'money-receipt') && (
            <NavLink to="/money-receipt" className="nav-item standalone">
              <Icon.receipt width={18} height={18} />
              <span className="ni-label">Money Receipt</span>
              {counts['money-receipt'] ? <span className="count">{counts['money-receipt']}</span> : null}
            </NavLink>
          )}

          {can(role, 'recycleBin') && (
            <NavLink to="/recycle-bin" className="nav-item standalone">
              <Icon.trash width={18} height={18} />
              <span className="ni-label">Recycle Bin</span>
            </NavLink>
          )}

          <div className="nav-divider" />

          <NavLink to="/settings" className="nav-item standalone">
            <Icon.settings width={18} height={18} />
            <span className="ni-label">Settings</span>
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
  const { assets } = useAssets()
  const canFinance = can(currentUser.role, 'financeView')
  const canAsset = can(currentUser.role, 'assetView')
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

  // Assets — searchable by ID, name, serial, brand/model or current holder.
  const assetResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !canAsset) return []
    return assets
      .filter((a) =>
        [a.assetId, a.name, a.serial, a.brand, a.model, custodianLabel(a)]
          .map((x) => (x || '').toString().toLowerCase())
          .join(' ')
          .includes(q),
      )
      .slice(0, 15)
  }, [query, assets, canAsset])

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
            {results.length === 0 && finResults.length === 0 && assetResults.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                No matches for “{query}”.
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
                {assetResults.length > 0 && (
                  <div>
                    <div className="search-group-label">Assets</div>
                    {assetResults.map((a) => (
                      <div key={a.id} className="search-result" onClick={() => { setQuery(''); setShowResults(false); navigate(`/assets/${a.id}`) }}>
                        <span className="sr-num mono">{a.assetId}</span>
                        <span className="muted">{a.name}</span>
                        <span className="grow" />
                        <span className="small">{custodianLabel(a)}</span>
                      </div>
                    ))}
                  </div>
                )}
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
