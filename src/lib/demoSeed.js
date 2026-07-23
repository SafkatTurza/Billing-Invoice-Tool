// ─────────────────────────────────────────────────────────────────────────────
// Safe demo-data seeding.
//
// Every demo record carries `demo: true` and a `demo-…` id, so seeding and
// resetting operate ONLY on demo records — real user data in the same arrays is
// never read, moved or removed. Seeding is idempotent: it first strips any
// existing demo records, then appends a freshly built set, so running it twice
// produces exactly one copy (never duplicates).
//
// This never runs at startup and is never wired into production boot logic — it
// is invoked only from the Super Admin/Admin "Demo Data" panel in Settings.
// ─────────────────────────────────────────────────────────────────────────────

import { ls, KEYS } from './storage.js'
import { buildDemoData } from './demoData.js'

// A record is demo data if it was stamped by the builder. We check the flag and
// (defensively) the id prefix, so a record missing one marker is still caught.
function isDemo(r) {
  return !!r && (r.demo === true || (typeof r.id === 'string' && r.id.startsWith('demo-')))
}

// The storage keys the demo dataset spans, paired with the built array to merge.
function targets(data) {
  return [
    [KEYS.clients, data.clients],
    [KEYS.vendors, data.vendors],
    [KEYS.docs, data.docs],
    [KEYS.finDocs, data.finDocs],
    [KEYS.finTxns, data.ledger],
    [KEYS.finRecurring, data.recurring],
  ]
}

// Keep only the real (non-demo) records currently in a key.
function realOnly(key) {
  const arr = ls.get(key, [])
  return Array.isArray(arr) ? arr.filter((r) => !isDemo(r)) : []
}

// True if any demo record exists in any of the demo-spanning keys.
export function hasDemoData() {
  const keys = [KEYS.clients, KEYS.vendors, KEYS.docs, KEYS.finDocs, KEYS.finTxns, KEYS.finRecurring]
  return keys.some((k) => {
    const arr = ls.get(k, [])
    return Array.isArray(arr) && arr.some(isDemo)
  })
}

// Seed (or re-seed) the demo dataset. Strips old demo records first so the
// result is deterministic and duplicate-free, and preserves every real record.
// Returns a per-key count of demo records written.
export function seedDemoData() {
  const data = buildDemoData()
  const written = {}
  for (const [key, demoArr] of targets(data)) {
    const kept = realOnly(key)
    ls.set(key, [...demoArr, ...kept])
    written[key] = demoArr.length
  }
  return written
}

// Remove ONLY demo records from every key, leaving all real data intact.
// Returns a per-key count of demo records removed.
export function resetDemoData() {
  const removed = {}
  const keys = [KEYS.clients, KEYS.vendors, KEYS.docs, KEYS.finDocs, KEYS.finTxns, KEYS.finRecurring]
  for (const key of keys) {
    const arr = ls.get(key, [])
    if (!Array.isArray(arr)) {
      removed[key] = 0
      continue
    }
    const kept = arr.filter((r) => !isDemo(r))
    removed[key] = arr.length - kept.length
    ls.set(key, kept)
  }
  return removed
}
