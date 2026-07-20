// Document soft-locking + per-user draft recovery (Addendum 20 & 21).
// These live directly in localStorage (shared across tabs) rather than React
// state, matching the original.

import { ls, KEYS } from './storage.js'

export const LOCK_TIMEOUT = 30 * 60 * 1000 // 30 minutes

function getLocks() {
  return ls.get(KEYS.locks, {}) || {}
}
function saveLocks(l) {
  ls.set(KEYS.locks, l)
}

// Returns the active lock for a doc, or null (auto-expiring stale locks).
export function checkDocLock(docId) {
  const locks = getLocks()
  const lock = locks[docId]
  if (!lock) return null
  if (Date.now() - lock.time > LOCK_TIMEOUT) {
    const n = { ...locks }
    delete n[docId]
    saveLocks(n)
    return null
  }
  return lock
}

export function acquireDocLock(docId, user) {
  const locks = getLocks()
  locks[docId] = {
    userId: user.id,
    name: user.fullName,
    department: user.department || '',
    time: Date.now(),
  }
  saveLocks(locks)
}

// Refresh the lock timestamp (called on activity) to keep it alive.
export function touchDocLock(docId, user) {
  const locks = getLocks()
  const lock = locks[docId]
  if (lock && lock.userId === user.id) {
    lock.time = Date.now()
    saveLocks(locks)
  }
}

export function releaseDocLock(docId, userId) {
  const locks = getLocks()
  if (locks[docId]?.userId === userId) {
    delete locks[docId]
    saveLocks(locks)
  }
}

export function forceReleaseDocLock(docId) {
  const locks = getLocks()
  delete locks[docId]
  saveLocks(locks)
}

// ── Draft helpers ─────────────────────────────────────────────────────────
const draftKey = (userId, type, docId) => `dcs_draft_${userId}_${type}_${docId || 'new'}`

export function saveDraft(userId, type, docId, data) {
  ls.set(draftKey(userId, type, docId), { data, savedAt: new Date().toISOString(), type, docId })
}
export function clearDraft(userId, type, docId) {
  ls.remove(draftKey(userId, type, docId))
}
export function getDraft(userId, type, docId) {
  return ls.get(draftKey(userId, type, docId), null)
}
export function findUserDrafts(userId) {
  const drafts = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(`dcs_draft_${userId}_`)) {
        const d = JSON.parse(localStorage.getItem(key) || 'null')
        if (d && d.data) drafts.push({ key, ...d })
      }
    }
  } catch {
    // ignore
  }
  return drafts
}
