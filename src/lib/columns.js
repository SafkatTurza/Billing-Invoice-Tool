// Shared line-item column configuration used by the editor (LineItems),
// the print skins (DocSkin) and the exporters (Excel / Word) so a customized
// document looks the same everywhere. Only visibility and header *labels* are
// configurable here — the pricing/amount rules live in pricing.js and are
// never touched by this module.

import { ls, KEYS } from './storage.js'

// Column keys in display order. `amount` is always shown; the item-name column
// can be hidden as long as Description stays visible (SRS "must show at least
// one of name/description").
export const COLUMN_KEYS = ['name', 'description', 'spec', 'qty', 'unit', 'rate', 'amount']
export const OPTIONAL_COLUMN_KEYS = ['name', 'description', 'spec', 'qty', 'unit', 'rate']
export const ALWAYS_ON_COLUMNS = ['amount']

export const DEFAULT_COL_LABELS = {
  name: 'Services / Items',
  description: 'Description',
  spec: 'Specification',
  qty: 'Qty',
  unit: 'Unit',
  rate: 'Rate',
  amount: 'Amount',
}

// Preset header choices offered per column (first entry is the default). The
// user can pick one of these or choose "Other" and type a custom header.
export const COL_PRESETS = {
  name: ['Services / Items', 'Items', 'Products', 'Services'],
  description: ['Description', 'Details', 'Notes'],
  spec: ['Specification', 'SKU', 'Model'],
  qty: ['Qty', 'Quantity', 'Hours', 'Units'],
  unit: ['Unit', 'UOM'],
  rate: ['Rate', 'Price', 'Unit Price'],
  amount: ['Amount', 'Total', 'Line Total'],
}

const isPO = (doc) => doc?.type === 'purchase-orders' || doc?.type === 'work-orders'

// Default visibility when the user hasn't overridden a column: everything on
// except Specification, which defaults on only for PO / Work Order documents.
// Legacy PO documents stored the spec preference on `doc.showSpec`; honor it
// so existing documents keep their column choice.
function defaultVisible(doc, key) {
  if (key === 'amount') return true
  if (key === 'spec') return doc?.showSpec !== undefined ? !!doc.showSpec : isPO(doc)
  return true
}

// Is a column currently shown? Respects the user's per-document override
// (doc.cols) and falls back to the sensible default above.
export function colVisible(doc, key) {
  if (key === 'amount') return true
  const v = doc?.cols?.[key]
  return v === undefined ? defaultVisible(doc, key) : v !== false
}

// The first table column shows the item name, or — if the name column is
// hidden — the description. Guarantees at least one is always rendered.
export function nameColKey(doc) {
  return colVisible(doc, 'name') ? 'name' : 'description'
}

// The header label to render for a column — the user's custom text if set,
// otherwise the standard name.
export function colLabel(doc, key) {
  const custom = doc?.colLabels?.[key]
  return custom && String(custom).trim() ? custom : DEFAULT_COL_LABELS[key]
}

// ── "Apply to all future documents" default ──────────────────────────────
// Persisted under its own key (not on `style`) so saving it doesn't spam the
// audit log. Shape: { cols: {...}, colLabels: {...} }.
export function getColumnDefault() {
  return ls.get(KEYS.docColumns, null)
}
export function saveColumnDefault(cols, colLabels) {
  ls.set(KEYS.docColumns, { cols: cols || {}, colLabels: colLabels || {} })
}
export function clearColumnDefault() {
  ls.remove(KEYS.docColumns)
}
