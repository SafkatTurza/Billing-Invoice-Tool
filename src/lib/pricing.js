// Pricing calculation — SRS section 4.3.
// VAT only appears when AIT/TAX is enabled (they are always a pair).

export function lineAmount(item) {
  const qty = Number(item.qty) || 0
  const rate = Number(item.rate) || 0
  if (rate > 0) {
    // Rate drives the amount and locks the field.
    // Qty 0/empty with a rate => amount = rate (SRS 4.2 lock table)
    return qty > 0 ? qty * rate : rate
  }
  // Rate empty/0 => manual amount
  return Number(item.manualAmount) || 0
}

// Whether the Amount field is locked (auto-calculated) for a line item.
export function isAmountLocked(item) {
  return (Number(item.rate) || 0) > 0
}

export function calcTotals(doc) {
  const items = doc.items || []
  const subtotal = items.reduce((sum, it) => sum + lineAmount(it), 0)

  const discountOn = !!doc.discountOn
  const discountRate = discountOn ? Number(doc.discountRate) || 0 : 0
  const discountAmount = subtotal * (discountRate / 100)
  const afterDiscount = subtotal - discountAmount

  const aitOn = !!doc.aitOn
  const aitRate = aitOn ? Number(doc.aitRate) || 0 : 0
  const aitAmount = afterDiscount * (aitRate / 100)

  // VAT only when AIT is on
  const vatRate = aitOn ? Number(doc.vatRate) || 0 : 0
  const vatAmount = aitOn ? (afterDiscount + aitAmount) * (vatRate / 100) : 0

  const grandTotal = afterDiscount + aitAmount + vatAmount

  return {
    subtotal,
    discountAmount,
    afterDiscount,
    aitAmount,
    vatAmount,
    grandTotal,
  }
}

// Milestone validation for PO/WO (SRS 5.3): amber < 100, red > 100, green = 100.
export function milestoneStatus(milestones = []) {
  const total = milestones.reduce((s, m) => s + (Number(m.percentage) || 0), 0)
  let state = 'ok'
  if (total < 100) state = 'under'
  else if (total > 100) state = 'over'
  else state = 'exact'
  return { total, state }
}
