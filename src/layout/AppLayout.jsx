import { useState, useMemo, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { can, canAccessDocType, canSeeDocument } from '../lib/roles.js'
import { Icon } from '../components/Icons.jsx'
import { PREFIX } from '../lib/numbering.js'
import { formatMoney, formatDateTime } from '../lib/format.js'
import '../styles/layout.css'

const DOC_TYPES = [
  { type: 'invoices', label: 'Invoices', icon: Icon.invoice },
  { type: 'estimates', label: 'Estimates', icon: Icon.estimate },
  { type: 'purchase-orders', label: 'Purchase Orders', icon: Icon.po },
  { type: 'work-orders', label: 'Work Orders', icon: Icon.wo },
  { type: 'money-receipt', label: 'Money Receipts', icon: Icon.receipt },
]

export default function AppLayout() {
  const { currentUser, company, docs } = useApp()
  const role = currentUser.role

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
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="mark">
            {company.logo ? <img src={company.logo} alt="" /> : 'D'}
          </div>
          <div className="name">
            {company.name || 'DCS Billing'}
            <span>Billing System</span>
          </div>
        </div>

        <nav className="nav-group">
          <NavLink to="/dashboard" className="nav-item">
            <Icon.dashboard width={18} height={18} />
            Dashboard
          </NavLink>
        </nav>

        <div className="nav-group">
          <div className="nav-group-label">Documents</div>
          {DOC_TYPES.filter((d) => canAccessDocType(role, d.type)).map((d) => (
            <NavLink key={d.type} to={`/${d.type}`} className="nav-item">
              <d.icon width={18} height={18} />
              {d.label}
              {counts[d.type] ? <span className="count">{counts[d.type]}</span> : null}
            </NavLink>
          ))}
        </div>

        {(can(role, 'auditLog') || can(role, 'recycleBin')) && (
          <div className="nav-group">
            <div className="nav-group-label">Administration</div>
            {can(role, 'auditLog') && (
              <NavLink to="/audit" className="nav-item">
                <Icon.audit width={18} height={18} />
                Audit Log
              </NavLink>
            )}
            {can(role, 'recycleBin') && (
              <NavLink to="/recycle-bin" className="nav-item">
                <Icon.trash width={18} height={18} />
                Recycle Bin
              </NavLink>
            )}
          </div>
        )}

        <div className="nav-group">
          <NavLink to="/settings" className="nav-item">
            <Icon.settings width={18} height={18} />
            Settings
          </NavLink>
        </div>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="avatar">{initials(currentUser.fullName)}</div>
            <div>
              <div className="u-name">{currentUser.fullName}</div>
              <div className="u-role">{currentUser.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <Topbar />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
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
            {results.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                No documents match “{query}”.
              </div>
            ) : (
              Object.entries(grouped).map(([type, list]) => (
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
              ))
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
