// Attachment storage — kept in IndexedDB (hundreds of MB headroom) rather than
// localStorage (~5MB), because scanned vouchers/bills would blow the quota fast.
// Records store only lightweight metadata + the attachment id; blobs live here.
//
// Rules (agreed with the user):
//  • 2 MB per file, multiple files per document.
//  • Images are downscaled/compressed before storing (a 5MB phone photo → ~300KB).
//  • PDFs are stored as-is (still capped at 2MB).

export const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2 MB
const DB_NAME = 'dcs_attachments'
const STORE = 'files'
const META = 'meta'

let dbPromise = null
function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode)
        const s = t.objectStore(store)
        const out = fn(s)
        t.oncomplete = () => resolve(out?.result ?? out)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

function uid() {
  return 'att-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// Downscale + re-encode an image to keep it small. Returns a Blob.
function compressImage(file, { maxDim = 1600, quality = 0.72 } = {}) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      const scale = Math.min(1, maxDim / Math.max(width, height))
      width = Math.round(width * scale)
      height = Math.round(height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => resolve(blob && blob.size < file.size ? blob : file),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

// Store a File. Compresses images first; rejects if still over the cap.
// Returns the metadata record (also persisted).
export async function putAttachment(file, { uploadedBy } = {}) {
  let blob = file
  const isImage = /^image\//.test(file.type)
  if (isImage) {
    try {
      blob = await compressImage(file)
    } catch {
      blob = file
    }
  }
  if (blob.size > MAX_FILE_BYTES) {
    const mb = (blob.size / 1024 / 1024).toFixed(1)
    throw new Error(`"${file.name}" is ${mb} MB after compression — over the 2 MB limit.`)
  }
  const id = uid()
  const meta = {
    id,
    name: file.name,
    mime: blob.type || file.type || 'application/octet-stream',
    size: blob.size,
    uploadedBy: uploadedBy || null,
    uploadedAt: new Date().toISOString(),
  }
  await tx(STORE, 'readwrite', (s) => s.put({ id, blob }))
  await tx(META, 'readwrite', (s) => s.put(meta))
  return meta
}

export async function getAttachmentMeta(id) {
  return new Promise((resolve, reject) => {
    openDB().then((db) => {
      const r = db.transaction(META, 'readonly').objectStore(META).get(id)
      r.onsuccess = () => resolve(r.result || null)
      r.onerror = () => reject(r.error)
    })
  })
}

export async function getAttachmentBlob(id) {
  return new Promise((resolve, reject) => {
    openDB().then((db) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
      r.onsuccess = () => resolve(r.result ? r.result.blob : null)
      r.onerror = () => reject(r.error)
    })
  })
}

// Object URL for previewing/opening an attachment. Caller revokes when done.
export async function getAttachmentURL(id) {
  const blob = await getAttachmentBlob(id)
  return blob ? URL.createObjectURL(blob) : null
}

export async function deleteAttachment(id) {
  await tx(STORE, 'readwrite', (s) => s.delete(id))
  await tx(META, 'readwrite', (s) => s.delete(id))
}

// Total bytes used by all stored attachments (for the usage meter).
export async function attachmentsUsage() {
  return new Promise((resolve) => {
    openDB().then((db) => {
      const r = db.transaction(META, 'readonly').objectStore(META).getAll()
      r.onsuccess = () => {
        const rows = r.result || []
        resolve({ count: rows.length, bytes: rows.reduce((s, m) => s + (m.size || 0), 0) })
      }
      r.onerror = () => resolve({ count: 0, bytes: 0 })
    })
  })
}

// Best-effort browser storage estimate (quota), when available.
export async function storageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate()
      return { usage, quota }
    } catch {
      return null
    }
  }
  return null
}

export function formatBytes(n) {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(n) / Math.log(1024))
  return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i]
}
