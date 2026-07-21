import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ls, KEYS } from '../lib/storage.js'
import { uid } from '../lib/format.js'
import { useApp } from './AppContext.jsx'
import { FIN_TYPES, FIN_STATUS, commitFinNumber, isVoucherType } from '../lib/finance.js'

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
  const [budgets, setBudgets] = useState(() => ls.get(KEYS.finBudgets, []))
  const [recurring, setRecurring] = useState(() => ls.get(KEYS.finRecurring, []))

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
  useEffect(() => {
    ls.set(KEYS.finBudgets, budgets)
  }, [budgets])
  useEffect(() => {
    ls.set(KEYS.finRecurring, recurring)
  }, [recurring])

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

  // Restore a soft-deleted finance doc / purge it for good (Recycle Bin).
  const restoreFinDoc = useCallback(
    (id) => {
      setFinDocs((prev) => prev.map((d) => (d.id === id ? { ...d, deleted: false, deletedAt: null, deletedBy: null } : d)))
      addAudit('Finance doc restored', id, '')
    },
    [addAudit],
  )
  const permanentDeleteFinDoc = useCallback(
    (id) => {
      setFinDocs((prev) => prev.filter((d) => d.id !== id))
      addAudit('Finance doc permanently deleted', id, '')
    },
    [addAudit],
  )

  // Duplicate any finance doc as a fresh draft — same content, cleared of its
  // number, signatures, status and any reversal history.
  const duplicateFinDoc = useCallback(
    (id) => {
      const src = finDocs.find((d) => d.id === id)
      if (!src) return null
      const clone = {
        ...src,
        // Legacy payment/debit vouchers duplicate into the unified type.
        type: isVoucherType(src.type) ? 'voucher' : src.type,
        id: uid(),
        docNumber: undefined,
        autoNumber: true,
        status: FIN_STATUS.DRAFT,
        signSlots: (src.signSlots || []).map((s) => ({ label: s.label, signed: false })),
        deleted: false,
        deletedAt: null,
        deletedBy: null,
        reversedAt: null,
        reversedBy: null,
        reversalReason: null,
        createdAt: undefined,
        updatedAt: undefined,
      }
      return saveFinDoc(clone)
    },
    [finDocs, saveFinDoc],
  )

  // Reverse an approved/recorded doc: void its ledger entries and mark it
  // Reversed (kept for audit — never silently deleted).
  const reverseFinDoc = useCallback(
    (id, reason) => {
      const doc = finDocs.find((d) => d.id === id)
      if (!doc) return
      voidTransactionsForDoc(id)
      setFinDocs((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: FIN_STATUS.REVERSED,
                reversedAt: new Date().toISOString(),
                reversedBy: currentUser?.fullName || 'Unknown',
                reversalReason: reason || '',
              }
            : d,
        ),
      )
      addAudit('Finance doc reversed', doc.docNumber, reason || '')
      notify(`${FIN_TYPES[doc.type]?.label || 'Document'} ${doc.docNumber} reversed`)
    },
    [finDocs, currentUser, voidTransactionsForDoc, addAudit, notify],
  )

  // Internal account transfer (contra): one linked out+in pair. Not an
  // approvable document — recorded straight to the ledger by Accounts.
  const postTransfer = useCallback(
    ({ fromAccountId, toAccountId, amount, currency, date, note }) => {
      const transferId = 't-' + uid()
      const fromName = accounts.find((a) => a.id === fromAccountId)?.name || 'account'
      const toName = accounts.find((a) => a.id === toAccountId)?.name || 'account'
      const amt = Number(amount) || 0
      const common = {
        txnDate: date,
        currency: currency || 'BDT',
        linkType: 'transfer',
        linkId: transferId,
        description: note || `Transfer: ${fromName} → ${toName}`,
      }
      postTransaction({ ...common, direction: 'out', amount: amt, accountId: fromAccountId, partyName: `To ${toName}` })
      postTransaction({ ...common, direction: 'in', amount: amt, accountId: toAccountId, partyName: `From ${fromName}` })
      addAudit('Account transfer', `${fromName} → ${toName}`, `${amt} ${currency}`)
      return transferId
    },
    [accounts, postTransaction, addAudit],
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

  // ── Bills / accounts payable (Phase E) ──
  // A bill records money *owed* — no cash moves yet, so no ledger entry on save.
  const saveBill = useCallback(
    (doc) => saveFinDoc({ ...doc, type: 'bill', status: doc.status || FIN_STATUS.RECORDED }),
    [saveFinDoc],
  )

  // Record a payment against a bill: posts one ledger 'out' entry and appends
  // the payment to the bill so its paid/outstanding figures stay in sync.
  const recordBillPayment = useCallback(
    (billId, payment) => {
      const bill = finDocs.find((d) => d.id === billId)
      if (!bill) return null
      const txn = postTransaction({
        txnDate: payment.date,
        direction: 'out',
        amount: Number(payment.amount) || 0,
        currency: bill.currency || 'BDT',
        accountId: payment.accountId || null,
        headId: bill.headId || null,
        partyName: bill.vendorName || '',
        description: `Bill payment — ${bill.billRef || bill.docNumber}`,
        linkType: 'bill',
        linkId: bill.id,
        docNumber: bill.docNumber,
        companyId: bill.companyId,
      })
      const entry = {
        id: uid(),
        date: payment.date,
        amount: Number(payment.amount) || 0,
        accountId: payment.accountId || null,
        note: payment.note || '',
        txnId: txn.id,
      }
      setFinDocs((prev) => prev.map((d) => (d.id === billId ? { ...d, payments: [...(d.payments || []), entry] } : d)))
      addAudit('Bill payment', bill.docNumber, `${entry.amount} ${bill.currency}`)
      return entry
    },
    [finDocs, postTransaction, addAudit],
  )

  // ── Budgets per head (Phase E) — a monthly spending cap per expense head ──
  const saveBudget = useCallback((headId, amount, currency = 'BDT') => {
    setBudgets((prev) => {
      const i = prev.findIndex((b) => b.headId === headId)
      const row = { id: prev[i]?.id || 'bg-' + uid(), headId, amount: Number(amount) || 0, currency }
      if (i >= 0) {
        const c = [...prev]
        c[i] = row
        return c
      }
      return [...prev, row]
    })
  }, [])
  const deleteBudget = useCallback((headId) => setBudgets((prev) => prev.filter((b) => b.headId !== headId)), [])

  // ── Recurring entries (Phase E) — templates that spawn an expense or bill ──
  const saveRecurring = useCallback((r) => {
    setRecurring((prev) => {
      const i = prev.findIndex((x) => x.id === r.id)
      if (i >= 0) {
        const c = [...prev]
        c[i] = r
        return c
      }
      return [...prev, { ...r, id: r.id || 'rc-' + uid() }]
    })
  }, [])
  const deleteRecurring = useCallback((id) => setRecurring((prev) => prev.filter((r) => r.id !== id)), [])

  // Generate this month's occurrence of a recurring template. Expenses post
  // straight to the ledger; bills create a payable due on the chosen day.
  const runRecurring = useCallback(
    (id, monthISO) => {
      const r = recurring.find((x) => x.id === id)
      if (!r) return null
      const month = monthISO || new Date().toISOString().slice(0, 7) // YYYY-MM
      if (r.lastRunMonth === month) return null // already generated this month
      const day = String(Math.min(28, Math.max(1, Number(r.dayOfMonth) || 1))).padStart(2, '0')
      const date = `${month}-${day}`
      const common = {
        companyId: company?.id || 'co-1',
        autoNumber: true,
        date,
        currency: r.currency || 'BDT',
        headId: r.headId || '',
        amount: Number(r.amount) || 0,
        description: r.description || r.name,
        attachments: [],
      }
      let created
      if (r.kind === 'bill') {
        created = saveBill({
          ...common,
          vendorName: r.vendorName || '',
          billRef: '',
          dueDate: date,
          payments: [],
        })
      } else {
        created = recordExpense({ ...common, type: 'expense', accountId: r.accountId || '', party: r.vendorName || '' })
      }
      setRecurring((prev) => prev.map((x) => (x.id === id ? { ...x, lastRunMonth: month } : x)))
      addAudit('Recurring generated', r.name, `${common.amount} ${common.currency}`)
      notify(`Recurring "${r.name}" generated for ${month}`)
      return created
    },
    [recurring, company, saveBill, recordExpense, addAudit, notify],
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
    budgets,
    recurring,
    saveBill,
    recordBillPayment,
    saveBudget,
    deleteBudget,
    saveRecurring,
    deleteRecurring,
    runRecurring,
    saveEmployee,
    deleteEmployee,
    saveAccount,
    deleteAccount,
    saveHead,
    deleteHead,
    saveFinDoc,
    deleteFinDoc,
    restoreFinDoc,
    permanentDeleteFinDoc,
    duplicateFinDoc,
    reverseFinDoc,
    postTransfer,
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
