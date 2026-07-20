// Thin localStorage wrapper.
// Every key used by the app is namespaced under the SRS-defined keys
// (dcs_co, dcs_docs, dcs_clients, dcs_vendors, dcs_style, plus the
// user/security keys added by the Addendum).

export const KEYS = {
  company: 'dcs_co', // legacy single-company (kept for migration)
  companies: 'dcs_companies', // multi-company array
  clientSeq: 'dcs_client_seq',
  locks: 'dcs_locks',
  docs: 'dcs_docs',
  clients: 'dcs_clients',
  vendors: 'dcs_vendors',
  style: 'dcs_style',
  users: 'dcs_users',
  security: 'dcs_security',
  audit: 'dcs_audit',
  notifs: 'dcs_notifs',
  counters: 'dcs_counters',
  session: 'dcs_session', // localStorage token (30-day)
}

export const ls = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null || raw === undefined) return fallback
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (err) {
      // localStorage ~5MB quota — surface but don't crash (SRS 12.1)
      console.error('localStorage write failed for', key, err)
      return false
    }
  },
  remove(key) {
    localStorage.removeItem(key)
  },
}

// sessionStorage variant for the non-persistent (checkbox off) session token
export const ss = {
  get(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  },
  remove(key) {
    sessionStorage.removeItem(key)
  },
}
