// Thin localStorage wrapper.
// Every key used by the app is namespaced under the SRS-defined keys
// (dcs_co, dcs_docs, dcs_clients, dcs_vendors, dcs_style, plus the
// user/security keys added by the Addendum).

export const KEYS = {
  company: 'dcs_co', // legacy single-company (kept for migration)
  companies: 'dcs_companies', // multi-company array
  clientSeq: 'dcs_client_seq',
  vendorSeq: 'dcs_vendor_seq',
  partyCodeV1: 'dcs_party_code_v1', // one-time client/vendor ID backfill flag
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
  // ── Finance module ──
  finAccounts: 'dcs_fin_accounts', // cash/bank/MFS accounts
  finHeads: 'dcs_fin_heads', // chart of account heads
  finDocs: 'dcs_fin_docs', // requisitions, vouchers, expenses (one array + type)
  finTxns: 'dcs_fin_txns', // ledger (posted transactions)
  finTemplates: 'dcs_fin_templates', // reusable document templates
  employees: 'dcs_employees', // salary (Phase B)
  finBudgets: 'dcs_fin_budgets', // monthly budget per expense head (Phase E)
  finRecurring: 'dcs_fin_recurring', // recurring expense/bill templates (Phase E)
  finSettings: 'dcs_fin_settings', // approval-workflow rules, e.g. routing threshold (Phase F)
  finLoans: 'dcs_fin_loans', // employee loans & advances (Phase H)
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
