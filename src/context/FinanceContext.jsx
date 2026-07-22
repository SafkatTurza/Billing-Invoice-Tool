import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ls, KEYS } from '../lib/storage.js'
import { uid } from '../lib/format.js'
import { useApp } from './AppContext.jsx'
import { can } from '../lib/roles.js'
import {
  FIN_TYPES,
  FIN_STATUS,
  commitFinNumber,
  commitTransactionId,
  isVoucherType,
  isPrimary,
  ledgerPostPlan,
  docFinalSlotIndex,
  approvalSlotIndex,
  docFxRate,
  pushTimeline,
  DEFAULT_FIN_SETTINGS,
} from '../lib/finance.js'
import { loanOutstanding, loanHistoryEntry } from '../lib/loans.js'

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
  const { currentUser, addAudit, notify, company, users } = useApp()

  const [accounts, setAccounts] = useState(() => ls.get(KEYS.finAccounts, null) || DEFAULT_ACCOUNTS)
  const [heads, setHeads] = useState(() => ls.get(KEYS.finHeads, null) || DEFAULT_HEADS)
  const [finDocs, setFinDocs] = useState(() => ls.get(KEYS.finDocs, []))
  const [ledger, setLedger] = useState(() => ls.get(KEYS.finTxns, []))
  const [templates, setTemplates] = useState(() => ls.get(KEYS.finTemplates, []))
  const [employees, setEmployees] = useState(() => ls.get(KEYS.employees, []))
  const [budgets, setBudgets] = useState(() => ls.get(KEYS.finBudgets, []))
  const [recurring, setRecurring] = useState(() => ls.get(KEYS.finRecurring, []))
  const [loans, setLoans] = useState(() => ls.get(KEYS.finLoans, []))
  const [finSettings, setFinSettings] = useState(() => ({ ...DEFAULT_FIN_SETTINGS, ...ls.get(KEYS.finSettings, {}) }))

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
  useEffect(() => {
    ls.set(KEYS.finLoans, loans)
  }, [loans])
  useEffect(() => {
    ls.set(KEYS.finSettings, finSettings)
  }, [finSettings])

  const saveFinSettings = useCallback((patch) => setFinSettings((prev) => ({ ...prev, ...patch })), [])

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
        if (doc.autoNumber) docNumber = commitFinNumber(doc.type, company, new Date(), doc)
        // A primary voucher grouping key — minted once so linked/internal
        // records can attach to the same financial transaction.
        let transactionId = doc.transactionId || ''
        if (isVoucherType(doc.type) && isPrimary(doc) && !transactionId) transactionId = commitTransactionId(doc.date)
        saved = {
          ...doc,
          docNumber,
          transactionId,
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
        // A duplicate is a fresh, independent primary transaction — never inherit
        // the source's grouping id or linked-record relationship.
        transactionId: '',
        financialRole: 'primary',
        linkedVoucherId: '',
        linkedVoucherType: '',
        linkedVoucherNumber: '',
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
                timeline: pushTimeline(d, 'reversed', reason, currentUser),
              }
            : d,
        ),
      )
      addAudit('Finance doc reversed', doc.docNumber, reason || '')
      notify(`${FIN_TYPES[doc.type]?.label || 'Document'} ${doc.docNumber} reversed`)
    },
    [finDocs, currentUser, voidTransactionsForDoc, addAudit, notify],
  )

  // ── Approval workflow (Phase F) ──────────────────────────────────────
  // Notify whoever can act on a doc next: the users whose role can sign the
  // next required slot (management for high-value/final, otherwise reviewers),
  // skipping the maker and anyone who already signed.
  const notifyNextApprovers = useCallback(
    (doc) => {
      const slots = doc.signSlots || []
      const nextIdx = slots.findIndex((s) => !s.signed)
      if (nextIdx < 0) return
      const approveIdx = approvalSlotIndex(doc, finSettings)
      if (approveIdx < 0 || nextIdx > approveIdx) return // no further approvals needed
      const needFinal = nextIdx === docFinalSlotIndex(doc)
      const perm = needFinal ? 'financeFinalApprove' : 'financeApprove'
      const routeType = isVoucherType(doc.type) ? 'voucher' : doc.type
      const link = `/finance/${routeType}/${doc.id}`
      const signedIds = new Set(slots.filter((s) => s.signed).map((s) => s.signerId))
      const label = FIN_TYPES[doc.type]?.label || 'Document'
      for (const u of users) {
        if (u.status === 'Pending' || u.status === 'Deactivated') continue
        if (!can(u.role, perm)) continue
        if (u.id === doc.createdBy) continue // maker can't approve own doc
        if (signedIds.has(u.id)) continue // already signed a slot
        notify(
          `${label} ${doc.docNumber} awaits your ${needFinal ? 'final approval' : 'review'} — ${slots[nextIdx].label}`,
          u.id,
          link,
        )
      }
    },
    [users, notify, finSettings],
  )

  // Reject a pending doc (terminal). Reason required; the maker is notified and
  // can duplicate-as-new to try again.
  const rejectFinDoc = useCallback(
    (id, reason) => {
      const doc = finDocs.find((d) => d.id === id)
      if (!doc) return
      setFinDocs((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: FIN_STATUS.REJECTED,
                rejectedAt: new Date().toISOString(),
                rejectedBy: currentUser?.fullName || 'Unknown',
                rejectionReason: reason || '',
                timeline: pushTimeline(d, 'rejected', reason, currentUser),
              }
            : d,
        ),
      )
      addAudit('Finance doc rejected', doc.docNumber, reason || '')
      const routeType = isVoucherType(doc.type) ? 'voucher' : doc.type
      if (doc.createdBy)
        notify(
          `${FIN_TYPES[doc.type]?.label || 'Document'} ${doc.docNumber} was rejected: ${reason || 'no reason given'}`,
          doc.createdBy,
          `/finance/${routeType}/${doc.id}`,
        )
    },
    [finDocs, currentUser, addAudit, notify],
  )

  // Send a pending doc back to the maker for correction: clears all signatures
  // and returns it to Draft so the preparer can edit and resubmit.
  const sendBackFinDoc = useCallback(
    (id, reason) => {
      const doc = finDocs.find((d) => d.id === id)
      if (!doc) return
      setFinDocs((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: FIN_STATUS.DRAFT,
                signSlots: (d.signSlots || []).map((s) => ({ label: s.label, signed: false })),
                sentBackAt: new Date().toISOString(),
                sentBackBy: currentUser?.fullName || 'Unknown',
                sentBackReason: reason || '',
                timeline: pushTimeline(d, 'sent-back', reason, currentUser),
              }
            : d,
        ),
      )
      addAudit('Finance doc sent back', doc.docNumber, reason || '')
      const routeType = isVoucherType(doc.type) ? 'voucher' : doc.type
      if (doc.createdBy)
        notify(
          `${FIN_TYPES[doc.type]?.label || 'Document'} ${doc.docNumber} was sent back for correction: ${reason || ''}`,
          doc.createdBy,
          `/finance/${routeType}/${doc.id}`,
        )
    },
    [finDocs, currentUser, addAudit, notify],
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
      const meta = FIN_TYPES[doc.type]
      // The single duplicate-prevention guard: linked/internal vouchers post
      // nothing, and no transaction is ever booked twice.
      const plan = ledgerPostPlan(doc, ledger)
      if (!plan.post) {
        if (plan.reason === 'linked') {
          addAudit('Finance doc approved', doc.docNumber, `${meta?.label} — linked internal record, no ledger impact`)
          notify(`${meta?.label} ${doc.docNumber} approved — linked record, no financial impact`)
        } else if (plan.reason === 'duplicate-transaction') {
          addAudit('Duplicate transaction blocked', doc.docNumber, `already booked under ${doc.transactionId}`)
        }
        return
      }
      // Cash-receipt vouchers post money IN; everything else pays OUT. A voucher
      // with an itemised breakdown posts one ledger line per head so the
      // expense-by-head report stays accurate; everything else posts one line.
      const rate = docFxRate(doc)
      const common = {
        txnDate: doc.date,
        direction: plan.direction,
        currency: doc.currency || 'BDT',
        fxRate: rate, // BDT per unit of doc currency, captured at approval
        accountId: doc.accountId || null,
        partyName: doc.receivedFrom || doc.party || doc.requester || '',
        linkType: doc.type,
        linkId: doc.id,
        docNumber: doc.docNumber,
        companyId: doc.companyId,
        transactionId: doc.transactionId || null, // enables cross-document dedupe
      }
      const breakdown = (doc.lines || []).filter((l) => Number(l.amount) > 0)
      if (breakdown.length) {
        for (const l of breakdown) {
          const amount = Number(l.amount) || 0
          postTransaction({
            ...common,
            amount,
            baseAmount: amount * rate, // BDT base for consolidated reporting
            headId: l.headId || doc.headId || null,
            description: l.description || doc.purpose || meta?.label,
          })
        }
      } else {
        const amount = Number(doc.amount) || Number(doc.total) || 0
        postTransaction({
          ...common,
          amount,
          baseAmount: amount * rate,
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
        baseAmount: (Number(saved.amount) || 0) * docFxRate(saved),
        currency: saved.currency || 'BDT',
        fxRate: docFxRate(saved),
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
        baseAmount: (Number(saved.amount) || 0) * docFxRate(saved),
        currency: saved.currency || 'BDT',
        fxRate: docFxRate(saved),
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
        baseAmount: (Number(payment.amount) || 0) * docFxRate(bill),
        currency: bill.currency || 'BDT',
        fxRate: docFxRate(bill),
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

  // ── Employee loans & advances (Phase H) ──
  // Only these fields are edited from the loan form. We never let the form's
  // in-memory clone overwrite the canonical repayments / history / status,
  // which are mutated exclusively through the settlement methods below.
  const LOAN_FORM_FIELDS = ['employeeId', 'empId', 'employeeName', 'type', 'principal', 'installment', 'currency', 'startDate', 'note']

  const saveLoan = useCallback(
    (loan, meta = {}) => {
      setLoans((prev) => {
        const i = prev.findIndex((l) => l.id === loan.id)
        if (i >= 0) {
          const prevLoan = prev[i]
          const patch = {}
          for (const k of LOAN_FORM_FIELDS) patch[k] = loan[k]
          const prevPrincipal = Number(prevLoan.principal) || 0
          const newPrincipal = Number(loan.principal) || 0
          const history = [...(prevLoan.history || [])]
          // Changing the original principal is a tracked financial change — the
          // previous and new values are preserved with the mandatory reason.
          if (Math.abs(newPrincipal - prevPrincipal) > 0.005) {
            history.push(
              loanHistoryEntry('Principal amount updated', currentUser, {
                prevAmount: prevPrincipal,
                newAmount: newPrincipal,
                diff: Math.round((newPrincipal - prevPrincipal) * 100) / 100,
                reason: meta.reason || '',
                outstandingAfter: loanOutstanding({ ...prevLoan, principal: newPrincipal }),
              }),
            )
          }
          const c = [...prev]
          c[i] = { ...prevLoan, ...patch, history }
          return c
        }
        const created = {
          ...loan,
          createdAt: loan.createdAt || new Date().toISOString(),
          createdBy: currentUser?.id || null,
          createdByName: currentUser?.fullName || 'Unknown',
          history: [
            ...(loan.history || []),
            loanHistoryEntry('Loan / advance created', currentUser, {
              newAmount: Number(loan.principal) || 0,
              reason: loan.note || '',
            }),
          ],
        }
        return [...prev, created]
      })
      addAudit('Loan saved', loan.empId || loan.employeeName, `${loan.type} ${loan.principal} ${loan.currency}`)
    },
    [addAudit, currentUser],
  )
  const deleteLoan = useCallback((id) => setLoans((prev) => prev.filter((l) => l.id !== id)), [])

  // Record a repayment against a loan. When it comes from a salary sheet the
  // sheetId guards against double-applying if the sheet is re-approved; the
  // amount is capped at the outstanding balance and the loan auto-closes. Every
  // repayment lands in the loan's audit history.
  const recordLoanRepayment = useCallback(
    (loanId, { sheetId, date, amount, note, method, reference }) => {
      setLoans((prev) =>
        prev.map((l) => {
          if (l.id !== loanId) return l
          if (sheetId && (l.repayments || []).some((r) => r.sheetId === sheetId)) return l
          const amt = Math.min(Number(amount) || 0, loanOutstanding(l))
          if (amt <= 0) return l
          const rep = {
            id: uid(),
            sheetId: sheetId || null,
            date,
            amount: amt,
            method: method || (sheetId ? 'Salary Deduction' : 'Cash'),
            reference: reference || '',
            note: note || '',
            attachments: [],
            recordedById: currentUser?.id || null,
            recordedByName: currentUser?.fullName || 'System',
            recordedAt: new Date().toISOString(),
          }
          const repayments = [...(l.repayments || []), rep]
          const repaid = repayments.reduce((s, r) => s + (Number(r.amount) || 0), 0)
          const closed = repaid >= (Number(l.principal) || 0) - 0.005
          const outstandingAfter = Math.max(0, Math.round(((Number(l.principal) || 0) - repaid) * 100) / 100)
          const history = [
            ...(l.history || []),
            loanHistoryEntry(closed ? 'Final settlement recorded' : 'Settlement recorded', currentUser, {
              newAmount: amt,
              method: rep.method,
              reference: rep.reference,
              reason: rep.note,
              settlementId: rep.id,
              outstandingAfter,
            }),
          ]
          return { ...l, repayments, status: closed ? 'closed' : 'active', history }
        }),
      )
    },
    [currentUser],
  )

  // Record a manual settlement / recovery (cash, bank, adjustment, write-off…)
  // against a loan. Stamped with who recorded it and when; the note is carried
  // permanently on the entry and mirrored into the audit history.
  const recordLoanSettlement = useCallback(
    (loanId, s) => {
      let saved = null
      setLoans((prev) =>
        prev.map((l) => {
          if (l.id !== loanId) return l
          const amt = Math.min(Number(s.amount) || 0, loanOutstanding(l))
          if (amt <= 0) return l
          const rep = {
            id: uid(),
            sheetId: null,
            date: s.date,
            amount: amt,
            method: s.method || 'Cash',
            reference: s.reference || '',
            note: s.note || '',
            attachments: s.attachments || [],
            recordedById: currentUser?.id || null,
            recordedByName: currentUser?.fullName || 'Unknown',
            recordedAt: new Date().toISOString(),
          }
          const repayments = [...(l.repayments || []), rep]
          const repaid = repayments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
          const closed = repaid >= (Number(l.principal) || 0) - 0.005
          const outstandingAfter = Math.max(0, Math.round(((Number(l.principal) || 0) - repaid) * 100) / 100)
          const history = [
            ...(l.history || []),
            loanHistoryEntry(closed ? 'Final settlement recorded' : 'Settlement recorded', currentUser, {
              newAmount: amt,
              method: rep.method,
              reference: rep.reference,
              reason: rep.note,
              attachments: rep.attachments,
              settlementId: rep.id,
              outstandingAfter,
            }),
          ]
          saved = rep
          return { ...l, repayments, status: closed ? 'closed' : 'active', history }
        }),
      )
      addAudit('Loan settlement recorded', loanId, `${s.amount} via ${s.method || 'Cash'}`)
      return saved
    },
    [currentUser, addAudit],
  )

  // Change an existing settlement amount / details. A reason is mandatory; the
  // previous amount is preserved in history and totals/status recalculated.
  const updateLoanSettlement = useCallback(
    (loanId, repaymentId, patch, reason) => {
      setLoans((prev) =>
        prev.map((l) => {
          if (l.id !== loanId) return l
          const idx = (l.repayments || []).findIndex((r) => r.id === repaymentId)
          if (idx < 0) return l
          const old = l.repayments[idx]
          const prevAmount = Number(old.amount) || 0
          const otherRepaid = l.repayments.reduce((s, r, i) => (i === idx ? s : s + (Number(r.amount) || 0)), 0)
          const maxAllowed = Math.max(0, (Number(l.principal) || 0) - otherRepaid)
          const newAmount = Math.min(patch.amount != null ? Number(patch.amount) || 0 : prevAmount, maxAllowed)
          const updated = {
            ...old,
            ...patch,
            amount: newAmount,
            updatedById: currentUser?.id || null,
            updatedByName: currentUser?.fullName || 'Unknown',
            updatedAt: new Date().toISOString(),
          }
          const repayments = [...l.repayments]
          repayments[idx] = updated
          const repaid = repayments.reduce((s, r) => s + (Number(r.amount) || 0), 0)
          const closed = repaid >= (Number(l.principal) || 0) - 0.005
          const outstandingAfter = Math.max(0, Math.round(((Number(l.principal) || 0) - repaid) * 100) / 100)
          const history = [
            ...(l.history || []),
            loanHistoryEntry('Settlement amount updated', currentUser, {
              prevAmount,
              newAmount,
              diff: Math.round((newAmount - prevAmount) * 100) / 100,
              reason: reason || '',
              method: updated.method,
              reference: updated.reference,
              settlementId: repaymentId,
              outstandingAfter,
            }),
          ]
          return { ...l, repayments, status: closed ? 'closed' : 'active', history }
        }),
      )
      addAudit('Loan settlement updated', loanId, reason || '')
    },
    [currentUser, addAudit],
  )

  // Reverse / cancel a settlement. A reason is mandatory. The entry is removed
  // from the running balance (which may reopen a settled loan) but the original
  // record and this reversal both remain in the audit history.
  const reverseLoanSettlement = useCallback(
    (loanId, repaymentId, reason) => {
      setLoans((prev) =>
        prev.map((l) => {
          if (l.id !== loanId) return l
          const target = (l.repayments || []).find((r) => r.id === repaymentId)
          if (!target) return l
          const repayments = (l.repayments || []).filter((r) => r.id !== repaymentId)
          const repaid = repayments.reduce((s, r) => s + (Number(r.amount) || 0), 0)
          const closed = repaid >= (Number(l.principal) || 0) - 0.005
          const outstandingAfter = Math.max(0, Math.round(((Number(l.principal) || 0) - repaid) * 100) / 100)
          const history = [
            ...(l.history || []),
            loanHistoryEntry('Settlement reversed', currentUser, {
              prevAmount: Number(target.amount) || 0,
              newAmount: 0,
              diff: -(Number(target.amount) || 0),
              reason: reason || '',
              method: target.method,
              reference: target.reference,
              settlementId: repaymentId,
              outstandingAfter,
            }),
          ]
          return { ...l, repayments, status: closed ? 'closed' : 'active', history }
        }),
      )
      addAudit('Loan settlement reversed', loanId, reason || '')
    },
    [currentUser, addAudit],
  )

  // Apply every loan installment carried on an approved salary sheet's lines.
  const applySalaryLoanRepayments = useCallback(
    (doc) => {
      for (const l of doc.lines || []) {
        if (l.loanId && Number(l.loanDeduction) > 0) {
          recordLoanRepayment(l.loanId, { sheetId: doc.id, date: l.paymentDate || doc.date, amount: Number(l.loanDeduction), note: `Salary ${doc.docNumber}` })
        }
      }
    },
    [recordLoanRepayment],
  )

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
    loans,
    finSettings,
    saveFinSettings,
    saveLoan,
    deleteLoan,
    recordLoanRepayment,
    recordLoanSettlement,
    updateLoanSettlement,
    reverseLoanSettlement,
    applySalaryLoanRepayments,
    notifyNextApprovers,
    rejectFinDoc,
    sendBackFinDoc,
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
