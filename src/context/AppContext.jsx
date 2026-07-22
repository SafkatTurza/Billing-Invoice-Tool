import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { ls, ss, KEYS } from '../lib/storage.js'
import { ROLES } from '../lib/roles.js'
import { uid } from '../lib/format.js'
import { hashPassword, hashAnswer } from '../lib/security.js'
import { commitDocNumber, generateUsername } from '../lib/numbering.js'
import { genClientCode, genVendorCode } from '../lib/clientCode.js'

const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

const DEFAULT_STYLE = { brandColor: '#1E2D5A', documentFont: 'Arial', template: 'modern' }
const DEFAULT_COMPANY = {
  id: 'co-1',
  logo: '',
  name: 'DreamCore Studio',
  code: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  brandColor: '',
  bank: { bankName: '', accountName: '', accountNumber: '', branch: '', routing: '', swift: '' },
}

// Seed the companies array — migrate a legacy single dcs_co if present.
function loadCompanies() {
  const arr = ls.get(KEYS.companies, null)
  if (Array.isArray(arr) && arr.length) return arr
  const legacy = ls.get(KEYS.company, null)
  if (legacy) return [{ ...DEFAULT_COMPANY, ...legacy, id: legacy.id || 'co-1' }]
  return [DEFAULT_COMPANY]
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
  const [companies, setCompanies] = useState(loadCompanies)
  // `company` = primary company (first) — used by sidebar, setup, defaults.
  const company = companies[0] || DEFAULT_COMPANY
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
    ls.set(KEYS.companies, companies)
    // keep legacy dcs_co mirrored to the primary company for compatibility
    ls.set(KEYS.company, companies[0] || DEFAULT_COMPANY)
  }, [companies])
  useEffect(() => {
    ls.set(KEYS.docs, docs)
  }, [docs])
  useEffect(() => {
    ls.set(KEYS.clients, clients)
  }, [clients])
  useEffect(() => {
    ls.set(KEYS.vendors, vendors)
  }, [vendors])

  // One-time backfill: give every existing client/vendor a human-readable ID.
  // Runs once (flag-guarded); assigns codes only to records that lack one, so
  // anything already coded (e.g. from the on-form quick-add) is left as-is.
  useEffect(() => {
    if (ls.get(KEYS.partyCodeV1, false)) return
    // No commitSeq here: the assigned codes persist in the array, and the next
    // suggestion scans them for the max — committing would reserve one extra and
    // leave a gap (e.g. the first new client jumping to -003).
    setClients((prev) => {
      const arr = prev.map((c) => ({ ...c }))
      let touched = false
      arr.forEach((c) => {
        if (!c.code) {
          c.code = genClientCode(company, c.field || 'GEN', c.name, arr)
          touched = true
        }
      })
      return touched ? arr : prev
    })
    setVendors((prev) => {
      const arr = prev.map((v) => ({ ...v }))
      let touched = false
      arr.forEach((v) => {
        if (!v.code) {
          v.code = genVendorCode(company, v.name, arr)
          touched = true
        }
      })
      return touched ? arr : prev
    })
    ls.set(KEYS.partyCodeV1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
      if (user.status === 'Pending')
        return { ok: false, error: 'This account is still awaiting admin approval.' }
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

  // ── Testing helper — one-click sign-in per role ──────────────────────
  // Simplified login for walking the app as each user level. Creates a demo
  // account for the role if missing (simple password "test", no forced change)
  // and starts a session. Remove this and the Login screen's demo panel when
  // the real auth flow is finalised.
  const quickDemoLogin = useCallback(
    (role) => {
      const unMap = {
        [ROLES.SUPER_ADMIN]: 'super',
        [ROLES.ADMIN]: 'admin',
        [ROLES.ACCOUNTS]: 'accounts',
        [ROLES.BUSINESS]: 'business',
      }
      const username = unMap[role] || 'demo'
      let user = users.find((u) => u.username === username)
      if (!user) {
        user = {
          id: 'demo-' + username,
          fullName: role + ' (Demo)',
          department: 'Testing',
          username,
          passwordHash: hashPassword('test'),
          systemPassword: null,
          role,
          status: 'Active',
          locked: false,
          failedAttempts: 0,
          mustChangePassword: false,
          securityQuestion: '',
          securityAnswerHash: '',
          createdBy: 'Demo',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          passwordChangedAt: null,
          previousHash: null,
        }
        setUsers((prev) => [...prev, user])
      }
      const token = { userId: user.id }
      ss.set(KEYS.session, token)
      ls.remove(KEYS.session)
      setSession(token)
    },
    [users],
  )

  const logout = useCallback(() => {
    if (currentUser) addAudit('Logout', currentUser.username, '')
    ls.remove(KEYS.session)
    ss.remove(KEYS.session)
    setSession(null)
  }, [currentUser, addAudit])

  // Auto-logout when a persistent (30-day) session reaches its expiry.
  useEffect(() => {
    if (!session?.expires) return
    const ms = session.expires - Date.now()
    if (ms <= 0) {
      logout()
      return
    }
    const t = setTimeout(logout, ms)
    return () => clearTimeout(t)
  }, [session, logout])

  // Extend a persistent session by another 30 days (Addendum 17.3).
  const extendSession = useCallback(() => {
    if (!session?.expires) return
    const token = { ...session, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 }
    ls.set(KEYS.session, token)
    setSession(token)
  }, [session])

  // First-launch super admin creation (Addendum 17.4)
  const createSuperAdmin = useCallback(
    ({ fullName, department, username, password, securityQuestion, securityAnswer }) => {
      const user = {
        id: uid(),
        fullName,
        department: department || 'Management',
        username,
        passwordHash: hashPassword(password),
        systemPassword: password, // kept until first change to enforce "cannot reuse" rule
        role: ROLES.SUPER_ADMIN,
        status: 'Active',
        securityQuestion: securityQuestion || '',
        securityAnswerHash: securityAnswer ? hashAnswer(securityAnswer) : '',
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

  // Self-signup — creates a Pending account awaiting admin approval (17.4 alt).
  const signup = useCallback(
    ({ fullName, department, email, password, securityQuestion, securityAnswer }) => {
      const username = generateUsername()
      const user = {
        id: uid(),
        fullName,
        department: department || '',
        email: email || '',
        username,
        passwordHash: hashPassword(password),
        systemPassword: null,
        role: '', // assigned on approval
        status: 'Pending',
        securityQuestion,
        securityAnswerHash: hashAnswer(securityAnswer),
        locked: false,
        failedAttempts: 0,
        mustChangePassword: false,
        createdBy: 'Self signup',
        createdAt: new Date().toISOString(),
        lastLogin: null,
        passwordChangedAt: null,
        previousHash: null,
      }
      setUsers((prev) => [...prev, user])
      addAudit('Signup request', username, fullName)
      notify(`New signup awaiting approval: ${fullName}`)
      return username
    },
    [addAudit, notify],
  )

  // Approve a Pending account: assign a role and activate it.
  const approveUser = useCallback(
    (userId, role) => {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role, status: 'Active' } : u)))
      const u = users.find((x) => x.id === userId)
      addAudit('User approved', u?.username || userId, `${role} — ${u?.fullName || ''}`)
      notify(`${u?.fullName || 'User'} approved as ${role}`)
    },
    [users, addAudit, notify],
  )

  // Forgot-password recovery: set a chosen password (security-question verified
  // in the UI). Unlocks the account; no forced change since the user chose it.
  const recoverPassword = useCallback(
    (userId, newPassword) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                previousHash: u.passwordHash,
                passwordHash: hashPassword(newPassword),
                systemPassword: null,
                mustChangePassword: false,
                locked: false,
                failedAttempts: 0,
                passwordChangedAt: new Date().toISOString(),
              }
            : u,
        ),
      )
      const u = users.find((x) => x.id === userId)
      addAudit('Password recovered (security question)', u?.username || userId, '')
    },
    [users, addAudit],
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

  // Store a user's own signature image (base64) — used to sign/approve docs.
  const setUserSignature = useCallback((userId, dataUrl) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, signatureImg: dataUrl } : u)))
  }, [])

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

  // ── Company management (multi-company) ───────────────────────────────
  const findCompany = useCallback(
    (doc) => {
      const id = doc?.companyId
      return companies.find((c) => c.id === id) || companies[0] || DEFAULT_COMPANY
    },
    [companies],
  )

  // Update the primary company (used by the legacy single-company Settings tab).
  const setCompany = useCallback(
    (next) => {
      setCompanies((prev) => {
        if (!prev.length) return [{ ...DEFAULT_COMPANY, ...next }]
        const copy = [...prev]
        copy[0] = { ...copy[0], ...next }
        return copy
      })
      addAudit('Company info changed', next.name || '', '')
    },
    [addAudit],
  )

  const addCompany = useCallback(
    (co) => {
      const withId = { ...DEFAULT_COMPANY, ...co, id: co.id || 'co-' + uid() }
      setCompanies((prev) => [...prev, withId])
      addAudit('Company added', withId.name || '', '')
      return withId
    },
    [addAudit],
  )

  const updateCompany = useCallback(
    (id, changes) => {
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)))
      addAudit('Company info changed', changes.name || id, '')
    },
    [addAudit],
  )

  const deleteCompany = useCallback(
    (id) => {
      setCompanies((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)))
      addAudit('Company removed', id, '')
    },
    [addAudit],
  )

  const setStyle = useCallback(
    (next) => {
      setStyleState(next)
      addAudit('Brand style changed', '', `Color ${next.brandColor}, Font ${next.documentFont}, Template ${next.template}`)
    },
    [addAudit],
  )

  // ── Data backup (SRS 9.2 / 9.3) ──────────────────────────────────────
  const exportAll = useCallback(() => {
    return {
      version: 'DCS-v6',
      exportedAt: new Date().toISOString(),
      company: companies[0],
      companies,
      docs,
      clients,
      vendors,
      style,
      users,
      security,
      counters: ls.get(KEYS.counters, {}),
      // Finance module (read straight from storage — owned by FinanceContext).
      finance: {
        accounts: ls.get(KEYS.finAccounts, []),
        heads: ls.get(KEYS.finHeads, []),
        finDocs: ls.get(KEYS.finDocs, []),
        finTxns: ls.get(KEYS.finTxns, []),
        finTemplates: ls.get(KEYS.finTemplates, []),
        employees: ls.get(KEYS.employees, []),
      },
    }
  }, [companies, docs, clients, vendors, style, users, security])

  const importAll = useCallback(
    (data) => {
      if (Array.isArray(data.companies) && data.companies.length) setCompanies(data.companies)
      else if (data.company) setCompanies([{ ...DEFAULT_COMPANY, ...data.company, id: data.company.id || 'co-1' }])
      if (data.docs) setDocs(data.docs)
      if (data.clients) setClients(data.clients)
      if (data.vendors) setVendors(data.vendors)
      if (data.style) setStyleState(data.style)
      if (data.users) setUsers(data.users)
      if (data.security) setSecurity(data.security)
      if (data.counters) ls.set(KEYS.counters, data.counters)
      // Finance stores are owned by FinanceContext; write to storage and let a
      // reload pick them up (import already replaces the whole dataset).
      if (data.finance) {
        const f = data.finance
        if (f.accounts) ls.set(KEYS.finAccounts, f.accounts)
        if (f.heads) ls.set(KEYS.finHeads, f.heads)
        if (f.finDocs) ls.set(KEYS.finDocs, f.finDocs)
        if (f.finTxns) ls.set(KEYS.finTxns, f.finTxns)
        if (f.finTemplates) ls.set(KEYS.finTemplates, f.finTemplates)
        if (f.employees) ls.set(KEYS.employees, f.employees)
      }
      addAudit('Data import', '', 'All data replaced from backup file')
    },
    [addAudit],
  )

  const value = {
    // state
    company,
    companies,
    docs,
    clients,
    vendors,
    style,
    users,
    security,
    auditLog,
    inAppNotifs,
    currentUser,
    sessionExpiry: session?.expires || null,
    extendSession,
    isSetupComplete: users.length > 0,
    // setters
    setCompany,
    addCompany,
    updateCompany,
    deleteCompany,
    findCompany,
    setClients,
    setVendors,
    setStyle,
    setSecurity,
    // auth
    login,
    logout,
    quickDemoLogin,
    createSuperAdmin,
    signup,
    approveUser,
    recoverPassword,
    addUser,
    changePassword,
    adminResetPassword,
    setUserStatus,
    setUserSignature,
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
