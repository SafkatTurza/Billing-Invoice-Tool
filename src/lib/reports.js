// Finance reporting & insight computations (Phase G). Pure functions off the
// posted ledger, accounts, heads, bills, recurring templates and billing
// invoices. Kept side-effect-free so the report pages stay thin and the logic
// is easy to reason about (and unit-test) on its own.
//
// The ledger is effectively single-entry cash accounting where every posted
// transaction touches one cash/bank account and (usually) one account head.
// That makes a balancing trial balance possible: money-in debits the account
// and credits an income head; money-out debits an expense head and credits the
// account; opening balances are carried by an "Opening Balance Equity" credit.
// Internal transfers (linkType 'transfer') move cash between two accounts and
// carry no head, so they net to zero across accounts and never touch the head
// totals — the sheet still balances.

import { billDue } from './finance.js'

// ── Small date helpers ────────────────────────────────────────────────────
export function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7) // YYYY-MM
}
export function monthLabel(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}
// The YYYY-MM keys for the `count` months ending at (and including) `endYm`.
export function monthRange(endYm, count) {
  const [y, m] = endYm.split('-').map(Number)
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
export function thisMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function num(v) {
  return Number(v) || 0
}
function posted(ledger) {
  return (ledger || []).filter((t) => t.status === 'posted')
}
function real(t) {
  // A "real" (non-transfer) money movement — the only kind that hits a head.
  return t.linkType !== 'transfer'
}
function txnDate(t) {
  return t.txnDate || t.createdAt || ''
}

// Every distinct currency present across accounts + posted ledger, sorted.
export function ledgerCurrencies(ledger, accounts) {
  const s = new Set()
  for (const a of accounts || []) if (a.currency) s.add(a.currency)
  for (const t of posted(ledger)) if (t.currency) s.add(t.currency)
  return [...s].sort()
}

// ── Account statement (per-account, bank-statement style) ──────────────────
// Opening balance = account opening + everything posted to it *before* `from`;
// then each in-range row with a running balance; then the closing balance.
export function accountStatement(ledger, account, { from = '', to = '' } = {}) {
  if (!account) return { opening: 0, rows: [], closing: 0, totalIn: 0, totalOut: 0 }
  const mine = posted(ledger)
    .filter((t) => t.accountId === account.id)
    .sort((a, b) => new Date(txnDate(a)) - new Date(txnDate(b)))

  let opening = num(account.openingBalance)
  const rows = []
  let running = 0
  let totalIn = 0
  let totalOut = 0

  for (const t of mine) {
    const d = txnDate(t).slice(0, 10)
    const delta = t.direction === 'in' ? num(t.amount) : -num(t.amount)
    if (from && d < from) {
      opening += delta
      continue
    }
    if (to && d > to) continue
    running += delta
    if (t.direction === 'in') totalIn += num(t.amount)
    else totalOut += num(t.amount)
    rows.push({ ...t, balance: opening + running })
  }
  return { opening, rows, closing: opening + running, totalIn, totalOut }
}

// ── General ledger by head ─────────────────────────────────────────────────
// Every real posting against one head in a date range, with a running total.
export function ledgerByHead(ledger, headId, { from = '', to = '' } = {}) {
  const rows = posted(ledger)
    .filter(real)
    .filter((t) => (headId === 'none' ? !t.headId : t.headId === headId))
    .filter((t) => {
      const d = txnDate(t).slice(0, 10)
      return (!from || d >= from) && (!to || d <= to)
    })
    .sort((a, b) => new Date(txnDate(a)) - new Date(txnDate(b)))

  const byCurrency = {} // cur → { in, out, net }
  let runIn = 0
  let runOut = 0
  const withRun = rows.map((t) => {
    const c = t.currency || 'BDT'
    byCurrency[c] = byCurrency[c] || { in: 0, out: 0, net: 0 }
    if (t.direction === 'in') {
      byCurrency[c].in += num(t.amount)
      runIn += num(t.amount)
    } else {
      byCurrency[c].out += num(t.amount)
      runOut += num(t.amount)
    }
    byCurrency[c].net = byCurrency[c].in - byCurrency[c].out
    return { ...t, runningNet: runIn - runOut }
  })
  return { rows: withRun, byCurrency }
}

// ── Trial balance (as of a date, per currency) ─────────────────────────────
// Returns { currencies: { [cur]: { rows:[{name,type,debit,credit}], totalDebit,
// totalCredit, balanced } } }. `type` is 'account' | 'equity' | 'head'.
export function trialBalance(ledger, accounts, heads, asOf = '') {
  const headById = Object.fromEntries((heads || []).map((h) => [h.id, h]))
  const upTo = (t) => !asOf || txnDate(t).slice(0, 10) <= asOf
  const rows = posted(ledger).filter(upTo)
  const currencies = {}
  const bucket = (c) =>
    (currencies[c] = currencies[c] || {
      accounts: {}, // accId → balance
      openingEquity: 0,
      heads: {}, // headId|'none-in'|'none-out' → { name, kind, in, out }
    })

  // Account opening balances + opening-balance equity.
  for (const a of accounts || []) {
    const b = bucket(a.currency || 'BDT')
    b.accounts[a.id] = (b.accounts[a.id] || 0) + num(a.openingBalance)
    b.openingEquity += num(a.openingBalance)
  }

  // Post each transaction to its account (always) and, when real, to its head.
  for (const t of rows) {
    const c = t.currency || 'BDT'
    const b = bucket(c)
    const delta = t.direction === 'in' ? num(t.amount) : -num(t.amount)
    if (t.accountId) b.accounts[t.accountId] = (b.accounts[t.accountId] || 0) + delta
    if (!real(t)) continue
    const key = t.headId || (t.direction === 'in' ? 'none-in' : 'none-out')
    const h = t.headId ? headById[t.headId] : null
    const name = h ? h.name : 'Uncategorised'
    const kind = h ? h.kind : t.direction === 'in' ? 'income' : 'expense'
    const cell = (b.heads[key] = b.heads[key] || { name, kind, in: 0, out: 0 })
    if (t.direction === 'in') cell.in += num(t.amount)
    else cell.out += num(t.amount)
  }

  const accName = Object.fromEntries((accounts || []).map((a) => [a.id, a.name]))
  const out = {}
  for (const [c, b] of Object.entries(currencies)) {
    const list = []
    // Assets — cash/bank accounts (debit when positive).
    for (const [accId, bal] of Object.entries(b.accounts)) {
      if (Math.abs(bal) < 0.005) continue
      list.push({ name: accName[accId] || 'Account', type: 'account', debit: bal >= 0 ? bal : 0, credit: bal < 0 ? -bal : 0 })
    }
    // Heads — income/investment credit, expense debit.
    for (const cell of Object.values(b.heads)) {
      const bal = cell.in - cell.out
      if (Math.abs(bal) < 0.005) continue
      const isCredit = cell.kind === 'income' || cell.kind === 'investment'
      list.push({
        name: cell.name,
        type: 'head',
        debit: isCredit ? 0 : Math.abs(bal),
        credit: isCredit ? Math.abs(bal) : 0,
      })
    }
    // Opening balance equity (credit) so the sheet balances.
    if (Math.abs(b.openingEquity) >= 0.005) {
      list.push({ name: 'Opening Balance Equity', type: 'equity', debit: b.openingEquity < 0 ? -b.openingEquity : 0, credit: b.openingEquity >= 0 ? b.openingEquity : 0 })
    }
    const totalDebit = list.reduce((s, r) => s + r.debit, 0)
    const totalCredit = list.reduce((s, r) => s + r.credit, 0)
    out[c] = { rows: list, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.05 }
  }
  return { currencies: out }
}

// ── Monthly trends (one currency) ──────────────────────────────────────────
// Income vs expense vs net for the trailing `months`, plus the top expense
// heads over the same window. Income = real money-in + paid billing invoices;
// investment is folded into inflow but tracked separately.
export function monthlyTrends(ledger, invoices, currency, months = 6, endYm = thisMonthKey()) {
  const keys = monthRange(endYm, months)
  const idx = Object.fromEntries(keys.map((k, i) => [k, i]))
  const series = keys.map((ym) => ({ ym, label: monthLabel(ym), income: 0, investment: 0, expense: 0, net: 0 }))
  const headTotals = {} // headName → total expense over window

  for (const t of posted(ledger)) {
    if ((t.currency || 'BDT') !== currency || !real(t)) continue
    const k = monthKey(txnDate(t))
    if (!(k in idx)) continue
    const row = series[idx[k]]
    if (t.direction === 'in') {
      if (t.kind === 'investment') row.investment += num(t.amount)
      else row.income += num(t.amount)
    } else {
      row.expense += num(t.amount)
    }
  }
  for (const d of invoices || []) {
    if (d.type !== 'invoices' || d.deleted || d.status !== 'Paid') continue
    if ((d.currency || 'BDT') !== currency) continue
    const k = monthKey(d.date)
    if (k in idx) series[idx[k]].income += num(d.grandTotal)
  }
  for (const row of series) row.net = row.income + row.investment - row.expense

  return { series, keys }
}

// Expense-by-head totals for a currency over a trailing window (for the
// insight page's breakdown). Returns [{ name, total }] sorted desc.
export function expenseHeadsOverWindow(ledger, heads, currency, months = 6, endYm = thisMonthKey()) {
  const keys = new Set(monthRange(endYm, months))
  const headById = Object.fromEntries((heads || []).map((h) => [h.id, h]))
  const totals = {}
  for (const t of posted(ledger)) {
    if (t.direction !== 'out' || !real(t) || (t.currency || 'BDT') !== currency) continue
    if (!keys.has(monthKey(txnDate(t)))) continue
    const name = t.headId ? headById[t.headId]?.name || 'Uncategorised' : 'Uncategorised'
    totals[name] = (totals[name] || 0) + num(t.amount)
  }
  return Object.entries(totals)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
}

// ── Cash-flow forecast (one currency) ──────────────────────────────────────
// Projects the running cash balance forward `months` from today. Expected
// outflows = recurring templates (every month) + open vendor bills (in their
// due month). Expected inflows = unpaid billing invoices (in their due/issue
// month). Nothing here posts to the ledger — it's a planning view only.
export function cashFlowForecast(
  { ledger, accounts, recurring, bills, invoices },
  currency,
  months = 6,
  now = new Date(),
) {
  // Starting cash = current balance across accounts in this currency.
  let startBalance = 0
  for (const a of accounts || []) {
    if ((a.currency || 'BDT') !== currency) continue
    startBalance += num(a.openingBalance)
  }
  for (const t of posted(ledger)) {
    if ((t.currency || 'BDT') !== currency) continue
    startBalance += t.direction === 'in' ? num(t.amount) : -num(t.amount)
  }

  const startYm = thisMonthKey(now)
  const [sy, sm] = startYm.split('-').map(Number)
  const future = []
  for (let i = 1; i <= months; i++) {
    const d = new Date(sy, sm - 1 + i, 1)
    future.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const idx = Object.fromEntries(future.map((k, i) => [k, i]))
  const rows = future.map((ym) => ({ ym, label: monthLabel(ym), inflow: 0, outflow: 0, recurringOut: 0, net: 0, balance: 0 }))

  // Recurring templates — a known cost every future month.
  const recurringMonthly = (recurring || [])
    .filter((r) => (r.currency || 'BDT') === currency)
    .reduce((s, r) => s + num(r.amount), 0)
  for (const row of rows) {
    row.recurringOut = recurringMonthly
    row.outflow += recurringMonthly
  }

  // Open vendor bills — outflow in the month they fall due.
  for (const b of bills || []) {
    if (b.type !== 'bill' || b.deleted || (b.currency || 'BDT') !== currency) continue
    const due = billDue(b)
    if (due <= 0 || !b.dueDate) continue
    const k = monthKey(b.dueDate)
    if (k in idx) rows[idx[k]].outflow += due
  }

  // Unpaid billing invoices — expected inflow in their due (or issue) month.
  for (const d of invoices || []) {
    if (d.type !== 'invoices' || d.deleted || (d.currency || 'BDT') !== currency) continue
    if (d.status === 'Paid' || d.status === 'Draft') continue
    const k = monthKey(d.dueDate || d.date)
    if (k in idx) rows[idx[k]].inflow += num(d.grandTotal)
  }

  let running = startBalance
  for (const row of rows) {
    row.net = row.inflow - row.outflow
    running += row.net
    row.balance = running
  }
  return { startBalance, rows, recurringMonthly }
}
