import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ls, KEYS } from '../lib/storage.js'
import { uid } from '../lib/format.js'
import { useApp } from './AppContext.jsx'
import { FIN_TYPES, FIN_STATUS, commitFinNumber } from '../lib/finance.js'

const FinanceContext = createContext(null)
export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider')
  return ctx
}

// Default chart of heads + one cash account, seeded on first run.
const DEFAULT_HEADS = [
  { id: 'h-income', name: 'Sales / Service Income', kind: 'income' },
  { id: 'h-invest', name: 'Investment / Capital', kind: 'investment' },
  { id: 'h-operational', name: 'Operational Expense', kind: 'expense' },
  { id: 'h-admin', name: 'Administrative Expense', kind: 'expense' },
  { id: 'h-utilities', name: 'Utilities & Rent', kind: 'expense' },
  { id: 'h-transport', name: 'Transport / Courier', kind: 'expense' },
  { id: 'h-salary', name: 'Salary & Remuneration', kind: 'expense' },
  { id: 'h-marketing', name: 'Marketing', kind: 'expense' },
  { id: 'h-misc', name: 'Miscellaneous', kind: 'expense' },
]
const DEFAULT_ACCOUNTS = [
  { id: 'a-cash', name: 'Cash in Hand', type: 'Cash', currency: 'BDT', openingBalance: 0 },
]

export function FinanceProvider({ children }) {
  const { currentUser, addAudit, notify, company } = useApp()

  const [accounts, setAccounts] = useState(() => ls.get(KEYS.finAccounts, null) || DEFAULT_ACCOUNTS)
  const [heads, setHeads] = useState(() => ls.get(KEYS.finHeads, null) || DEFAULT_HEADS)
  const [finDocs, setFinDocs] = useState(() => ls.get(KEYS.finDocs, []))
  const [ledger, setLedger] = useState(() => ls.get(KEYS.finTxns, []))
  const [templates, setTemplates] = useState(() => ls.get(KEYS.finTemplates, []))
  const [employees, setEmployees] = useState(() => ls.get(KEYS.employees, []))

  useEffect(() => {
    ls.set(KEYS.finAccounts, accounts)
  }, [accounts])
  useEffect(() => {
    ls.set(KEYS.finHeads, heads)
  }, [heads])
  useEffect(() => {
    ls.set(KEYS.finDocs, finDocs)
  }, [finDocs])
  useEffect(() => {
    ls.set(KEYS.finTxns, ledger)
  }, [ledger])
  useEffect(() => {
    ls.set(KEYS.finTemplates, templates)
  }, [templates])
  useEffect(() => {
    ls.set(KEYS.employees, employees)
  }, [employees])

  // ── Masters ──
  const saveAccount = useCallback((acc) => {
    setAccounts((prev) => {
      const i = prev.findIndex((a) => a.id === acc.id)
      if (i >= 0) {
        const c = [...prev]
        c[i] = acc
        return c
      }
      return [...prev, { ...acc, id: acc.id || 'a-' + uid() }]
    })
  }, [])
  const deleteAccount = useCallback((id) => setAccounts((prev) => prev.filter((a) => a.id !== id)), [])

  const saveHead = useCallback((head) => {
    setHeads((prev) => {
      const i = prev.findIndex((h) => h.id === head.id)
      if (i >= 0) {
        const c = [...prev]
        c[i] = head
        return c
      }
      return [...prev, { ...head, id: head.id || 'h-' + uid() }]
    })
  }, [])
  const deleteHead = useCallback((id) => setHeads((prev) => prev.filter((h) => h.id !== id)), [])

  // ── Ledger ──
  const postTransaction = useCallback(
    (txn) => {
      const entry = {
        id: uid(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id || null,
        status: 'posted',
        ...txn,
      }
      setLedger((prev) => [entry, ...prev])
      return entry
    },
    [currentUser],
  )

  // Reverse (void) all ledger entries linked to a doc — used if an approval is
  // undone. We never hard-delete posted entries; we mark them void.
  const voidTransactionsForDoc = useCallback((docId) => {
    setLedger((prev) => prev.map((t) => (t.linkId === docId ? { ...t, status: 'void' } : t)))
  }, [])

  // ── Finance documents ──
  const saveFinDoc = useCallback(
    (doc) => {
      const now = new Date().toISOString()
      let saved
      setFinDocs((prev) => {
        const i = prev.findIndex((d) => d.id === doc.id)
        if (i >= 0) {
          saved = { ...prev[i], ...doc, updatedAt: now }
          const c = [...prev]
          c[i] = saved
          return c
        }
        let docNumber = doc.docNumber
        if (doc.autoNumber) docNumber = commitFinNumber(doc.type, company)
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
    [currentUser, company],
  )

  const deleteFinDoc = useCallback(
    (id) => {
      const doc = finDocs.find((d) => d.id === id)
      setFinDocs((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, deleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser?.fullName } : d,
        ),
      )
      voidTransactionsForDoc(id)
      addAudit('Finance doc deleted', doc?.docNumber || id, doc?.title || '')
    },
    [finDocs, currentUser, addAudit, voidTransactionsForDoc],
  )

  // When a doc reaches Approved, post it to the ledger (once).
  const onDocApproved = useCallback(
    (doc) => {
      // Avoid double-posting: skip if already posted for this doc.
      const already = ledger.some((t) => t.linkId === doc.id && t.status === 'posted')
      if (already) return
      const meta = FIN_TYPES[doc.type]
      // Vouchers & requisitions are money OUT (expenses/payments). A voucher with
      // an itemised breakdown posts one ledger line per head so the expense-by-head
      // report stays accurate; everything else posts a single line.
      const common = {
        txnDate: doc.date,
        direction: 'out',
        currency: doc.currency || 'BDT',
        accountId: doc.accountId || null,
        partyName: doc.receivedFrom || doc.party || doc.requester || '',
        linkType: doc.type,
        linkId: doc.id,
        docNumber: doc.docNumber,
        companyId: doc.companyId,
      }
      const breakdown = (doc.lines || []).filter((l) => Number(l.amount) > 0)
      if (breakdown.length) {
        for (const l of breakdown) {
          postTransaction({
            ...common,
            amount: Number(l.amount) || 0,
            headId: l.headId || doc.headId || null,
            description: l.description || doc.purpose || meta?.label,
          })
        }
      } else {
        postTransaction({
          ...common,
          amount: Number(doc.amount) || Number(doc.total) || 0,
          headId: doc.headId || null,
          description: doc.purpose || doc.title || meta?.label,
        })
      }
      addAudit('Finance doc approved', doc.docNumber, `${meta?.label} — posted to ledger`)
      notify(`${meta?.label} ${doc.docNumber} approved & posted`)
    },
    [ledger, postTransaction, addAudit, notify],
  )

  // Record a standalone daily expense straight into the ledger.
  const recordExpense = useCallback(
    (doc) => {
      const saved = saveFinDoc({ ...doc, status: FIN_STATUS.RECORDED })
      postTransaction({
        txnDate: saved.date,
        direction: 'out',
        amount: Number(saved.amount) || 0,
        currency: saved.currency || 'BDT',
        accountId: saved.accountId || null,
        headId: saved.headId || null,
        partyName: saved.party || '',
        description: saved.description || 'Daily expense',
        linkType: 'expense',
        linkId: saved.id,
        docNumber: saved.docNumber,
        companyId: saved.companyId,
      })
      addAudit('Expense recorded', saved.docNumber, saved.description || '')
      return saved
    },
    [saveFinDoc, postTransaction, addAudit],
  )

  // Record income / investment straight into the ledger (money IN). Phase C.
  const recordIncome = useCallback(
    (doc) => {
      const saved = saveFinDoc({ ...doc, type: 'income', status: FIN_STATUS.RECORDED })
      postTransaction({
        txnDate: saved.date,
        direction: 'in',
        amount: Number(saved.amount) || 0,
        currency: saved.currency || 'BDT',
        accountId: saved.accountId || null,
        headId: saved.headId || null,
        partyName: saved.party || '',
        description: saved.description || (saved.kind === 'investment' ? 'Investment / Capital' : 'Income'),
        kind: saved.kind || 'income',
        linkType: 'income',
        linkId: saved.id,
        docNumber: saved.docNumber,
        companyId: saved.companyId,
      })
      addAudit('Income recorded', saved.docNumber, saved.description || '')
      return saved
    },
    [saveFinDoc, postTransaction, addAudit],
  )

  // ── Templates ──
  const saveTemplate = useCallback((tpl) => {
    setTemplates((prev) => {
      const i = prev.findIndex((t) => t.id === tpl.id)
      if (i >= 0) {
        const c = [...prev]
        c[i] = tpl
        return c
      }
      return [...prev, { ...tpl, id: tpl.id || 't-' + uid() }]
    })
  }, [])
  const deleteTemplate = useCallback((id) => setTemplates((prev) => prev.filter((t) => t.id !== id)), [])

  // ── Employees ──
  const saveEmployee = useCallback(
    (emp) => {
      setEmployees((prev) => {
        const i = prev.findIndex((e) => e.id === emp.id)
        if (i >= 0) {
          const c = [...prev]
          c[i] = emp
          return c
        }
        return [...prev, emp]
      })
      addAudit('Employee saved', emp.empId, emp.name)
    },
    [addAudit],
  )
  const deleteEmployee = useCallback((id) => setEmployees((prev) => prev.filter((e) => e.id !== id)), [])

  const value = {
    accounts,
    heads,
    finDocs,
    ledger,
    templates,
    employees,
    saveEmployee,
    deleteEmployee,
    saveAccount,
    deleteAccount,
    saveHead,
    deleteHead,
    saveFinDoc,
    deleteFinDoc,
    recordExpense,
    recordIncome,
    onDocApproved,
    postTransaction,
    voidTransactionsForDoc,
    saveTemplate,
    deleteTemplate,
  }
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}
