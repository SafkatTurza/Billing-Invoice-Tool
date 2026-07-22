// Asset Management domain — constants, ID generation, warranty maths, filters.
// Design principle: ONE ASSET = ONE PERMANENT RECORD + CURRENT STATE + a
// COMPLETE, append-only LIFECYCLE HISTORY. Purchase/repair figures only
// *reference* existing Paynox finance records — nothing here posts to the
// ledger, so a purchase is never booked twice.

import { ls, KEYS } from './storage.js'
import { uid, todayISO } from './format.js'

// ── Controlled vocabularies (kept separate on purpose, §6/§19/§20) ──────────
export const OWNERSHIP = ['Company Owned', 'Leased', 'Rented', 'Other']
export const USAGE = ['Individual', 'Common/Shared', 'Office Use']
export const CUSTODY = ['Employee', 'Department', 'Team', 'Project', 'Office', 'Storage']
export const LOCATIONS = ['Office', 'Office Room', 'Remote Employee', 'Storage', 'External', 'Other']

// Status = where the asset is in its operational life (§19).
export const STATUSES = [
  'Available',
  'Assigned',
  'In Use',
  'In Storage',
  'Under Repair',
  'Missing',
  'Lost',
  'Disposed',
  'Sold',
  'Written Off',
]
// Terminal statuses can't transition further (kept for history, never deleted).
export const TERMINAL_STATUSES = ['Disposed', 'Sold', 'Written Off']

// Condition = physical state, independent of status (§20).
export const CONDITIONS = ['New', 'Excellent', 'Good', 'Fair', 'Poor', 'Damaged', 'Unusable']

export const WORK_TYPES = ['Office', 'Remote', 'Hybrid']
export const WARRANTY_UNITS = ['Days', 'Months', 'Years']
export const REPAIR_RESULTS = ['Repaired', 'Partially Repaired', 'Unrepairable', 'Replacement Recommended', 'Written Off']
export const DAMAGE_ACTIONS = ['Continue Using', 'Repair', 'Warranty Claim', 'Mark Unusable', 'Write Off']
export const DISPOSAL_TYPES = ['Sold', 'Scrapped', 'Donated', 'Written Off', 'Other']
export const INCIDENT_TYPES = ['Missing', 'Lost', 'Recovered']

// Lifecycle event types recorded on asset.history[] (§23). Business events —
// distinct from the system Audit Log.
export const EVENT = {
  CREATED: 'Asset Created',
  PURCHASED: 'Purchase Recorded',
  ASSIGNED: 'Assigned',
  TRANSFERRED: 'Transferred',
  RETURNED: 'Returned',
  LOCATION: 'Location Changed',
  CUSTODIAN: 'Custodian Changed',
  CONDITION: 'Condition Changed',
  STATUS: 'Status Changed',
  DAMAGE: 'Damage Reported',
  WARRANTY_CLAIM: 'Warranty Claim',
  REPAIR_SENT: 'Sent for Repair',
  REPAIR_DONE: 'Repair Completed',
  WARRANTY_EXT: 'Warranty Extended',
  MISSING: 'Reported Missing',
  LOST: 'Marked Lost',
  RECOVERED: 'Recovered',
  DISPOSED: 'Disposed',
  WRITEOFF: 'Written Off',
  SOLD: 'Sold',
  EDITED: 'Details Edited',
}

// ── Default category tree (§3). Each subcategory carries a short code used in
// the Asset ID (DCS-LAP-0001). Fully editable in Settings → Asset Categories. ──
export const DEFAULT_CATEGORIES = [
  cat('IT Equipment', 'IT', [
    ['Laptop', 'LAP'], ['Desktop', 'DSK'], ['Workstation', 'WKS'], ['Server', 'SRV'],
  ]),
  cat('Computer Components', 'CMP', [
    ['GPU', 'GPU'], ['CPU', 'CPU'], ['RAM', 'RAM'], ['SSD', 'SSD'], ['HDD', 'HDD'], ['Motherboard', 'MBD'],
  ]),
  cat('Display', 'DIS', [
    ['Monitor', 'MON'], ['Television', 'TV'], ['Touch Display', 'TCH'],
  ]),
  cat('Mobile', 'MOB', [
    ['Smartphone', 'PHN'], ['Tablet', 'TAB'], ['iPad', 'IPD'],
  ]),
  cat('XR / Testing', 'XR', [
    ['VR Headset', 'VR'], ['AR Device', 'AR'], ['Controller', 'CTL'], ['Testing Device', 'TST'],
  ]),
  cat('Accessories', 'ACC', [
    ['Keyboard', 'KEY'], ['Mouse', 'MOU'], ['Headset', 'HDS'], ['Webcam', 'CAM'], ['Speaker', 'SPK'],
  ]),
  cat('Networking', 'NET', [
    ['Router', 'RTR'], ['Switch', 'SWT'], ['Access Point', 'AP'],
  ]),
  cat('Power', 'PWR', [
    ['UPS', 'UPS'], ['IPS', 'IPS'], ['Generator', 'GEN'],
  ]),
  cat('Office Equipment', 'OFF', [
    ['Printer', 'PRN'], ['Scanner', 'SCN'], ['Projector', 'PRJ'],
  ]),
  cat('Furniture', 'FUR', [
    ['Desk', 'DEK'], ['Chair', 'CHR'], ['Cabinet', 'CAB'],
  ]),
  cat('Appliances', 'APP', [
    ['Air Conditioner', 'AC'], ['Refrigerator', 'REF'], ['Microwave', 'MWV'],
  ]),
  cat('Security', 'SEC', [
    ['CCTV', 'CCT'], ['DVR/NVR', 'DVR'], ['Access Control', 'ACS'],
  ]),
  cat('Other', 'OTH', [
    ['Custom', 'OTH'],
  ]),
]

function cat(name, code, subs) {
  return {
    id: 'cat-' + code.toLowerCase(),
    name,
    code,
    active: true,
    subs: subs.map(([n, c]) => ({ id: 'sub-' + c.toLowerCase(), name: n, code: c, active: true })),
  }
}

// Suggested (editable) spec fields per subcategory code — the profile prefills
// these so irrelevant fields never show, but any key/value can be added (§5).
export const SPEC_TEMPLATES = {
  LAP: ['Processor', 'RAM', 'Storage', 'GPU', 'Screen Size'],
  DSK: ['Processor', 'RAM', 'Storage', 'GPU'],
  WKS: ['Processor', 'RAM', 'Storage', 'GPU'],
  SRV: ['Processor', 'RAM', 'Storage', 'Rack Units'],
  MON: ['Screen Size', 'Resolution', 'Panel Type', 'Refresh Rate'],
  TV: ['Screen Size', 'Resolution', 'Panel Type'],
  TCH: ['Screen Size', 'Resolution', 'Touch Type'],
  PHN: ['Processor', 'RAM', 'Storage', 'Screen Size'],
  TAB: ['Processor', 'RAM', 'Storage', 'Screen Size'],
  IPD: ['Chip', 'Storage', 'Screen Size'],
  VR: ['Resolution', 'Refresh Rate', 'Tracking', 'Controllers'],
  AR: ['Resolution', 'Field of View'],
  GPU: ['Chipset', 'VRAM'],
  CPU: ['Cores', 'Base Clock'],
  RAM: ['Capacity', 'Type', 'Speed'],
  SSD: ['Capacity', 'Interface'],
  HDD: ['Capacity', 'RPM'],
  PRN: ['Type', 'Colour', 'Duplex'],
  RTR: ['Ports', 'Wi-Fi Standard', 'Throughput'],
  SWT: ['Ports', 'Managed'],
  AC: ['Capacity (Ton)', 'Type'],
}

export function specTemplate(subCode) {
  return SPEC_TEMPLATES[subCode] || []
}

// ── Category lookup helpers ─────────────────────────────────────────────────
export function findCategory(categories, catId) {
  return (categories || []).find((c) => c.id === catId) || null
}
export function findSub(categories, catId, subId) {
  const c = findCategory(categories, catId)
  return c ? (c.subs || []).find((s) => s.id === subId) || null : null
}

// ── Asset ID: DCS-LAP-0001 (company + subcategory code + per-code sequence) ──
export function companyAssetPrefix(company) {
  return ((company && (company.code || abbrev(company.name))) || 'DCS').toUpperCase().replace(/[^A-Z0-9]/g, '')
}
function abbrev(name) {
  const n = (name || '').trim()
  if (!n) return 'DCS'
  const caps = n.replace(/[^A-Z]/g, '')
  if (caps.length >= 2) return caps.slice(0, 3)
  return n.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'DCS'
}

// Highest sequence already used for a subcategory code — scans live records so
// a manually-typed or imported ID can never be handed out twice (§4, rule #1).
function maxSeqForCode(assets, code, counters) {
  let mx = Number(counters?.[code]) || 0
  const re = new RegExp('-' + code + '-(\\d+)$', 'i')
  for (const a of assets || []) {
    const m = re.exec(a.assetId || '')
    if (m) mx = Math.max(mx, parseInt(m[1], 10))
  }
  return mx
}

export function previewAssetId(company, subCode, assets, counters) {
  const code = (subCode || 'OTH').toUpperCase()
  const seq = maxSeqForCode(assets, code, counters) + 1
  return `${companyAssetPrefix(company)}-${code}-${String(seq).padStart(4, '0')}`
}

// Reserve the next sequence for a code. Returns the updated counters map (the
// caller persists it). Never reuses a number.
export function commitAssetSeq(subCode, assets, counters) {
  const code = (subCode || 'OTH').toUpperCase()
  const seq = maxSeqForCode(assets, code, counters) + 1
  return { counters: { ...(counters || {}), [code]: seq }, code, seq }
}

// ── Warranty maths (§15) ────────────────────────────────────────────────────
export function computeWarrantyEnd(startISO, period, unit) {
  if (!startISO || !period) return ''
  const d = new Date(startISO)
  if (isNaN(d)) return ''
  const n = Number(period) || 0
  if (unit === 'Days') d.setDate(d.getDate() + n)
  else if (unit === 'Years') d.setFullYear(d.getFullYear() + n)
  else d.setMonth(d.getMonth() + n) // Months (default)
  return d.toISOString().slice(0, 10)
}

// Effective warranty end: explicit endDate wins, else derive from start (or
// purchase date fallback) + period/unit.
export function warrantyEnd(asset) {
  const w = asset?.warranty || {}
  if (!w.has) return ''
  if (w.endDate) return w.endDate
  const start = w.startDate || asset?.purchase?.date || ''
  return computeWarrantyEnd(start, w.period, w.unit)
}

// 'none' | 'active' | 'expiring' | 'expired' given a warning window (days).
export function warrantyStatus(asset, warnDays = 30, today = todayISO()) {
  const w = asset?.warranty || {}
  if (!w.has) return 'none'
  const end = warrantyEnd(asset)
  if (!end) return 'active' // has warranty but no end recorded → treat as active
  const days = daysBetween(today, end)
  if (days < 0) return 'expired'
  if (days <= warnDays) return 'expiring'
  return 'active'
}

export function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO)
  const b = new Date(toISO)
  if (isNaN(a) || isNaN(b)) return NaN
  return Math.round((b - a) / 86400000)
}

export const WARRANTY_BADGE = {
  none: { label: 'No Warranty', cls: 'badge-gray' },
  active: { label: 'Under Warranty', cls: 'badge-green' },
  expiring: { label: 'Expiring Soon', cls: 'badge-amber' },
  expired: { label: 'Warranty Expired', cls: 'badge-red' },
}

export const STATUS_BADGE = {
  Available: 'badge-green',
  Assigned: 'badge-blue',
  'In Use': 'badge-blue',
  'In Storage': 'badge-gray',
  'Under Repair': 'badge-amber',
  Missing: 'badge-amber',
  Lost: 'badge-red',
  Disposed: 'badge-gray',
  Sold: 'badge-gray',
  'Written Off': 'badge-red',
}
export const CONDITION_BADGE = {
  New: 'badge-green',
  Excellent: 'badge-green',
  Good: 'badge-teal',
  Fair: 'badge-amber',
  Poor: 'badge-amber',
  Damaged: 'badge-red',
  Unusable: 'badge-red',
}

// ── Derived helpers on an asset ─────────────────────────────────────────────
export function activeAssignment(asset) {
  return (asset?.assignments || []).find((a) => a.status === 'active') || null
}
export function lifetimeRepairCost(asset) {
  return (asset?.repairs || []).reduce((s, r) => s + (Number(r.companyCost) || 0), 0)
}
export function repairCostInYear(asset, year) {
  return (asset?.repairs || [])
    .filter((r) => (r.date || '').slice(0, 4) === String(year))
    .reduce((s, r) => s + (Number(r.companyCost) || 0), 0)
}
export function isTerminal(asset) {
  return TERMINAL_STATUSES.includes(asset?.status)
}

// A short, human label for who currently holds the asset.
export function custodianLabel(asset) {
  const a = activeAssignment(asset)
  if (a) return a.name || a.empId || 'Employee'
  const t = asset?.custodyType
  if (t === 'Employee') return asset?.custodianName || '—'
  if (t === 'Department') return asset?.custodianDept || 'Department'
  if (t === 'Team') return asset?.custodianTeam || 'Team'
  if (t === 'Project') return asset?.custodianProject || 'Project'
  return t || '—'
}

// ── History entry factory (§23) ─────────────────────────────────────────────
export function historyEntry(type, user, extra = {}) {
  return {
    id: uid(),
    at: new Date().toISOString(), // system timestamp
    date: extra.date || todayISO(), // business date
    type,
    by: user?.fullName || 'System',
    byId: user?.id || null,
    ...extra,
  }
}

// ── New asset factory ───────────────────────────────────────────────────────
export function newAsset(company) {
  return {
    id: uid(),
    assetId: '', // committed on first save
    companyId: company?.id || 'co-1',
    name: '',
    categoryId: '',
    subId: '',
    categoryName: '',
    subName: '',
    catCode: '',
    brand: '',
    model: '',
    serial: '',
    description: '',
    specs: [], // [{ key, value }]
    photos: [],
    documents: [],
    // Separate dimensions (§6)
    ownership: 'Company Owned',
    usage: 'Individual',
    custodyType: 'Storage',
    custodianEmployeeId: '',
    custodianEmpId: '',
    custodianName: '',
    custodianDept: '',
    custodianTeam: '',
    custodianProject: '',
    location: 'Storage',
    locationRoom: '',
    status: 'Available',
    condition: 'New',
    // Optional purchase / financial references (§12) — never posts to ledger
    purchase: {
      tracked: false,
      date: '',
      vendorId: '',
      vendorName: '',
      amount: '',
      currency: 'BDT',
      invoiceRef: '',
      requisitionRef: '',
      poRef: '',
      billRef: '',
      voucherRef: '',
      txnRef: '',
      paymentRef: '',
      notes: '',
    },
    warranty: {
      has: false,
      provider: '',
      vendorId: '',
      startDate: '',
      period: '',
      unit: 'Months',
      endDate: '',
      type: '',
      terms: '',
      reference: '',
      notes: '',
      extensions: [], // { prevEnd, newEnd, reason, date }
    },
    assignments: [], // append-only; current one has status 'active'
    repairs: [],
    damages: [],
    incidents: [], // missing / lost / recovered
    disposal: null,
    history: [],
    createdAt: '',
    updatedAt: '',
    createdBy: null,
    createdByName: '',
  }
}

// ── Register filtering (§25) ────────────────────────────────────────────────
// A single predicate builder so the Register, quick-views and dashboard drill
// -downs all filter identically.
export function matchesFilters(asset, f, warnDays = 30) {
  if (!f) return true
  const s = (v) => (v || '').toString().toLowerCase()
  if (f.q) {
    const q = s(f.q)
    const hay = [asset.assetId, asset.name, asset.brand, asset.model, asset.serial, custodianLabel(asset)]
      .map(s)
      .join(' ')
    if (!hay.includes(q)) return false
  }
  if (f.categoryId && asset.categoryId !== f.categoryId) return false
  if (f.subId && asset.subId !== f.subId) return false
  if (f.status && asset.status !== f.status) return false
  if (f.condition && asset.condition !== f.condition) return false
  if (f.usage && asset.usage !== f.usage) return false
  if (f.ownership && asset.ownership !== f.ownership) return false
  if (f.location && asset.location !== f.location) return false
  if (f.custodyType && asset.custodyType !== f.custodyType) return false
  if (f.vendorId && asset.purchase?.vendorId !== f.vendorId) return false
  if (f.warranty && warrantyStatus(asset, warnDays) !== f.warranty) return false
  if (f.employeeId) {
    const a = activeAssignment(asset)
    if (!a || a.employeeId !== f.employeeId) return false
  }
  if (f.assigned === 'assigned' && !activeAssignment(asset)) return false
  if (f.assigned === 'unassigned' && activeAssignment(asset)) return false
  if (f.brand && s(asset.brand) !== s(f.brand)) return false
  return true
}

// Named quick-views (§26) → a filter object each.
export const QUICK_VIEWS = [
  { id: 'all', label: 'All Assets', filter: {} },
  { id: 'available', label: 'Available', filter: { status: 'Available' } },
  { id: 'assigned', label: 'Assigned', filter: { assigned: 'assigned' } },
  { id: 'remote', label: 'Remote Assets', filter: { location: 'Remote Employee' } },
  { id: 'office', label: 'Office Assets', filter: { usage: 'Office Use' } },
  { id: 'common', label: 'Common / Shared', filter: { usage: 'Common/Shared' } },
  { id: 'warranty', label: 'Under Warranty', filter: { warranty: 'active' } },
  { id: 'expiring', label: 'Warranty Expiring', filter: { warranty: 'expiring' } },
  { id: 'expired', label: 'Warranty Expired', filter: { warranty: 'expired' } },
  { id: 'repair', label: 'Under Repair', filter: { status: 'Under Repair' } },
  { id: 'damaged', label: 'Damaged', filter: { condition: 'Damaged' } },
  { id: 'missing', label: 'Missing', filter: { status: 'Missing' } },
  { id: 'lost', label: 'Lost', filter: { status: 'Lost' } },
  { id: 'disposed', label: 'Disposed', filter: { status: 'Disposed' } },
  { id: 'writtenoff', label: 'Written Off', filter: { status: 'Written Off' } },
]

// Default module settings (persisted under KEYS.assetSettings).
export const DEFAULT_ASSET_SETTINGS = {
  counters: {}, // { LAP: 3, MON: 5, ... }
  warrantyWarnDays: 30,
  savedViews: [], // [{ id, name, filter }]
  seedV1: false,
}
