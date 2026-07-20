import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { ls, ss, KEYS } from '../lib/storage.js'
import { ROLES } from '../lib/roles.js'
import { uid } from '../lib/format.js'
import { hashPassword } from '../lib/security.js'
import { commitDocNumber } from '../lib/numbering.js'

const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

const DEFAULT_STYLE = { brandColor: '#1E2D5A', documentFont: 'Arial' }
const DEFAULT_COMPANY = {
  logo: '',
  name: 'DreamCore Studio',
  email: '',
  phone: '',
  website: '',
  address: '',
}

// Resolve which session token is active. localStorage token (30-day) wins,
// then sessionStorage (per-tab). Returns { userId } or null.
function readSession() {
  const persistent = ls.get(KEYS.session, null)
  if (persistent) {
    if (persistent.expires && Date.now() > persistent.expires) {
      ls.remove(KEYS.session)
    } else {
      return persistent
    }
  }
  const perTab = ss.get(KEYS.session, null)
  return perTab
}

export function AppProvider({ children }) {
  const [company, setCompanyState] = useState(() => ls.get(KEYS.company, DEFAULT_COMPANY))
  const [docs, setDocs] = useState(() => ls.get(KEYS.docs, []))
  const [clients, setClients] = useState(() => ls.get(KEYS.clients, []))
  const [vendors, setVendors] = useState(() => ls.get(KEYS.vendors, []))
  const [style, setStyleState] = useState(() => ls.get(KEYS.style, DEFAULT_STYLE))
  const [users, setUsers] = useState(() => ls.get(KEYS.users, []))
  const [security, setSecurity] = useState(() =>
    ls.get(KEYS.security, { emails: ['', '', ''] }),
  )
  const [auditLog, setAuditLog] = useState(() => ls.get(KEYS.audit, []))
  const [inAppNotifs, setInAppNotifs] = useState(() => ls.get(KEYS.notifs, []))

  const [session, setSession] = useState(() => readSession())

  const currentUser = useMemo(
    () => (session ? users.find((u) => u.id === session.userId) || null : null),
    [session, users],
  )

  // ── Persistence effects ──────────────────────────────────────────────
  // NB: wrap ls.set in a block — it returns a boolean, and an effect that
  // returns a non-function makes React throw "destroy is not a function".
  useEffect(() => {
    ls.set(KEYS.company, company)
  }, [company])
  useEffect(() => {
    ls.set(KEYS.docs, docs)
  }, [docs])
  useEffect(() => {
    ls.set(KEYS.clients, clients)
  }, [clients])
  useEffect(() => {
    ls.set(KEYS.vendors, vendors)
  }, [vendors])
  useEffect(() => {
    ls.set(KEYS.style, style)
  }, [style])
  useEffect(() => {
    ls.set(KEYS.users, users)
  }, [users])
  useEffect(() => {
    ls.set(KEYS.security, security)
  }, [security])
  useEffect(() => {
    ls.set(KEYS.audit, auditLog)
  }, [auditLog])
  useEffect(() => {
    ls.set(KEYS.notifs, inAppNotifs)
  }, [inAppNotifs])

  // ── Audit logging ────────────────────────────────────────────────────
  const addAudit = useCallback(
    (action, target, details) => {
      const actor = session ? users.find((u) => u.id === session.userId) : null
      const entry = {
        id: uid(),
        timestamp: new Date().toISOString(),
        user: actor ? `${actor.fullName} (${actor.role})` : 'System',
        userId: actor?.id || null,
        action,
        target: target || '',
        details: details || '',
      }
      setAuditLog((prev) => [entry, ...prev].slice(0, 1000))
    },
    [session, users],
  )

  // ── In-app notifications ─────────────────────────────────────────────
  const notify = useCallback((message, toUserId = null, link = null) => {
    const n = {
      id: uid(),
      message,
      toUserId, // null = broadcast to admins
      link,
      time: new Date().toISOString(),
      read: false,
    }
    setInAppNotifs((prev) => [n, ...prev].slice(0, 500))
  }, [])

  const markNotifRead = useCallback((id) => {
    setInAppNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const clearNotifs = useCallback(
    (userId) => {
      setInAppNotifs((prev) =>
        prev.filter((n) => n.toUserId && n.toUserId !== userId),
      )
    },
    [],
  )

  // ── Auth ─────────────────────────────────────────────────────────────
  const login = useCallback(
    (username, password, remember) => {
      const user = users.find((u) => u.username === username)
      if (!user) return { ok: false, error: 'Invalid username or password.' }
      if (user.status === 'Deactivated')
        return { ok: false, error: 'This account has been deactivated. Contact your Administrator.' }
      if (user.locked)
        return { ok: false, error: 'Your account has been locked. Please contact your Administrator.' }

      if (user.passwordHash !== hashPassword(password)) {
        // increment failed attempts (Addendum 19.4)
        const attempts = (user.failedAttempts || 0) + 1
        const locked = attempts >= 5
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, failedAttempts: attempts, locked } : u,
          ),
        )
        if (locked) {
          addAudit('Account locked', user.username, '5 consecutive failed login attempts')
          notify(`Account locked: ${user.fullName} (${user.username})`)
        } else {
          addAudit('Failed login attempt', user.username, `${attempts} of 5`)
        }
        return {
          ok: false,
          error: locked
            ? 'Your account has been locked. Please contact your Administrator.'
            : `Invalid username or password. (${5 - attempts} attempts remaining)`,
        }
      }

      // success
      const now = new Date().toISOString()
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, failedAttempts: 0, lastLogin: now }
            : u,
        ),
      )
      const token = { userId: user.id }
      if (remember) {
        token.expires = Date.now() + 30 * 24 * 60 * 60 * 1000
        ls.set(KEYS.session, token)
        ss.remove(KEYS.session)
      } else {
        ss.set(KEYS.session, token)
        ls.remove(KEYS.session)
      }
      setSession(token)
      addAudit('Successful login', user.username, '')
      return { ok: true, user, mustChangePassword: user.mustChangePassword }
    },
    [users, addAudit, notify],
  )

  const logout = useCallback(() => {
    if (currentUser) addAudit('Logout', currentUser.username, '')
    ls.remove(KEYS.session)
    ss.remove(KEYS.session)
    setSession(null)
  }, [currentUser, addAudit])

  // First-launch super admin creation (Addendum 17.4)
  const createSuperAdmin = useCallback(
    ({ fullName, department, username, password }) => {
      const user = {
        id: uid(),
        fullName,
        department: department || 'Management',
        username,
        passwordHash: hashPassword(password),
        systemPassword: password, // kept until first change to enforce "cannot reuse" rule
        role: ROLES.SUPER_ADMIN,
        status: 'Active',
        locked: false,
        failedAttempts: 0,
        mustChangePassword: true,
        createdBy: 'System (First Launch)',
        createdAt: new Date().toISOString(),
        lastLogin: null,
        passwordChangedAt: null,
        previousHash: null,
      }
      setUsers([user])
      addAudit('User created', username, `Super Admin — ${fullName}`)
      return user
    },
    [addAudit],
  )

  const addUser = useCallback(
    ({ fullName, department, role, username, password, createdByName }) => {
      const user = {
        id: uid(),
        fullName,
        department: department || '',
        username,
        passwordHash: hashPassword(password),
        systemPassword: password,
        role,
        status: 'Active',
        locked: false,
        failedAttempts: 0,
        mustChangePassword: true,
        createdBy: createdByName || 'Admin',
        createdAt: new Date().toISOString(),
        lastLogin: null,
        passwordChangedAt: null,
        previousHash: null,
      }
      setUsers((prev) => [...prev, user])
      addAudit('User created', username, `${role} — ${fullName}`)
      notify(`New user created: ${fullName} (${role})`)
      return user
    },
    [addAudit, notify],
  )

  const changePassword = useCallback(
    (userId, newPassword) => {
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u
          return {
            ...u,
            previousHash: u.passwordHash,
            passwordHash: hashPassword(newPassword),
            systemPassword: null,
            mustChangePassword: false,
            locked: false,
            failedAttempts: 0,
            passwordChangedAt: new Date().toISOString(),
          }
        }),
      )
      const u = users.find((x) => x.id === userId)
      addAudit('Password changed', u?.username || userId, '')
    },
    [users, addAudit],
  )

  const adminResetPassword = useCallback(
    (userId, tempPassword) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                previousHash: u.passwordHash,
                passwordHash: hashPassword(tempPassword),
                systemPassword: tempPassword,
                mustChangePassword: true,
                locked: false,
                failedAttempts: 0,
              }
            : u,
        ),
      )
      const u = users.find((x) => x.id === userId)
      addAudit('Password reset by Admin', u?.username || userId, 'Temporary password issued')
      notify(`Password reset for ${u?.fullName || userId}`)
    },
    [users, addAudit, notify],
  )

  const setUserStatus = useCallback(
    (userId, status) => {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)))
      const u = users.find((x) => x.id === userId)
      const action = status === 'Deactivated' ? 'User deactivated' : 'User reactivated'
      addAudit(action, u?.username || userId, '')
      notify(`${u?.fullName || 'User'} ${status === 'Deactivated' ? 'deactivated' : 'reactivated'}`)
    },
    [users, addAudit, notify],
  )

  // ── Documents ────────────────────────────────────────────────────────
  const saveDocument = useCallback(
    (doc) => {
      const now = new Date().toISOString()
      let saved
      setDocs((prev) => {
        const existingIdx = prev.findIndex((d) => d.id === doc.id)
        if (existingIdx >= 0) {
          saved = { ...prev[existingIdx], ...doc, updatedAt: now }
          const copy = [...prev]
          copy[existingIdx] = saved
          return copy
        }
        // First save of a new document: reserve the real serial now (unless
        // the user typed their own number), so abandoned drafts leave no gaps.
        let docNumber = doc.docNumber
        if (doc.autoNumber) docNumber = commitDocNumber(doc.type)
        saved = {
          ...doc,
          docNumber,
          autoNumber: false,
          id: doc.id || uid(),
          createdAt: doc.createdAt || now,
          updatedAt: now,
          createdBy: doc.createdBy || currentUser?.id || null,
          createdByName: doc.createdByName || currentUser?.fullName || 'Unknown',
        }
        return [saved, ...prev]
      })
      return saved
    },
    [currentUser],
  )

  const deleteDocument = useCallback(
    (id) => {
      const doc = docs.find((d) => d.id === id)
      // Soft-delete into recycle bin (Addendum 24.1)
      setDocs((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, deleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser?.fullName }
            : d,
        ),
      )
      addAudit('Document deleted', doc?.docNumber || id, doc?.partyName || '')
    },
    [docs, currentUser, addAudit],
  )

  const restoreDocument = useCallback(
    (id) => {
      const doc = docs.find((d) => d.id === id)
      setDocs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, deleted: false, deletedAt: null, deletedBy: null } : d)),
      )
      addAudit('Document restored', doc?.docNumber || id, '')
    },
    [docs, addAudit],
  )

  const permanentDelete = useCallback(
    (id) => {
      setDocs((prev) => prev.filter((d) => d.id !== id))
    },
    [],
  )

  // ── Settings mutators (with audit) ───────────────────────────────────
  const setCompany = useCallback(
    (next) => {
      setCompanyState(next)
      addAudit('Company info changed', next.name || '', '')
    },
    [addAudit],
  )

  const setStyle = useCallback(
    (next) => {
      setStyleState(next)
      addAudit('Brand style changed', '', `Color ${next.brandColor}, Font ${next.documentFont}`)
    },
    [addAudit],
  )

  // ── Data backup (SRS 9.2 / 9.3) ──────────────────────────────────────
  const exportAll = useCallback(() => {
    return {
      version: 'DCS-v6',
      exportedAt: new Date().toISOString(),
      company,
      docs,
      clients,
      vendors,
      style,
      users,
      security,
      counters: ls.get(KEYS.counters, {}),
    }
  }, [company, docs, clients, vendors, style, users, security])

  const importAll = useCallback(
    (data) => {
      if (data.company) setCompanyState(data.company)
      if (data.docs) setDocs(data.docs)
      if (data.clients) setClients(data.clients)
      if (data.vendors) setVendors(data.vendors)
      if (data.style) setStyleState(data.style)
      if (data.users) setUsers(data.users)
      if (data.security) setSecurity(data.security)
      if (data.counters) ls.set(KEYS.counters, data.counters)
      addAudit('Data import', '', 'All data replaced from backup file')
    },
    [addAudit],
  )

  const value = {
    // state
    company,
    docs,
    clients,
    vendors,
    style,
    users,
    security,
    auditLog,
    inAppNotifs,
    currentUser,
    isSetupComplete: users.length > 0,
    // setters
    setCompany,
    setClients,
    setVendors,
    setStyle,
    setSecurity,
    // auth
    login,
    logout,
    createSuperAdmin,
    addUser,
    changePassword,
    adminResetPassword,
    setUserStatus,
    // docs
    saveDocument,
    deleteDocument,
    restoreDocument,
    permanentDelete,
    // audit + notifs
    addAudit,
    notify,
    markNotifRead,
    clearNotifs,
    // backup
    exportAll,
    importAll,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
