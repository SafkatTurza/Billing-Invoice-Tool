// Shared line-item column configuration used by the editor (LineItems),
// the print skins (DocSkin) and the exporters (Excel / Word) so a customized
// document looks the same everywhere. Only visibility and header *labels* are
// configurable here — the pricing/amount rules live in pricing.js and are
// never touched by this module.

// Column keys in display order. `name` (Services / Items) and `amount` are
// always shown; the rest can be toggled per document.
export const COLUMN_KEYS = ['name', 'description', 'spec', 'qty', 'unit', 'rate', 'amount']
export const OPTIONAL_COLUMN_KEYS = ['description', 'spec', 'qty', 'unit', 'rate']
export const ALWAYS_ON_COLUMNS = ['name', 'amount']

export const DEFAULT_COL_LABELS = {
  name: 'Services / Items',
  description: 'Description',
  spec: 'Specification',
  qty: 'Qty',
  unit: 'Unit',
  rate: 'Rate',
  amount: 'Amount',
}

const isPO = (doc) => doc?.type === 'purchase-orders' || doc?.type === 'work-orders'

// Default visibility when the user hasn't overridden a column: everything on
// except Specification, which defaults on only for PO / Work Order documents.
// Legacy PO documents stored the spec preference on `doc.showSpec`; honor it
// so existing documents keep their column choice.
function defaultVisible(doc, key) {
  if (key === 'name' || key === 'amount') return true
  if (key === 'spec') return doc?.showSpec !== undefined ? !!doc.showSpec : isPO(doc)
  return true
}

// Is a column currently shown? Respects the user's per-document override
// (doc.cols) and falls back to the sensible default above.
export function colVisible(doc, key) {
  if (key === 'name' || key === 'amount') return true
  const v = doc?.cols?.[key]
  return v === undefined ? defaultVisible(doc, key) : v !== false
}

// The header label to render for a column — the user's custom text if set,
// otherwise the standard name.
export function colLabel(doc, key) {
  const custom = doc?.colLabels?.[key]
  return custom && String(custom).trim() ? custom : DEFAULT_COL_LABELS[key]
}
