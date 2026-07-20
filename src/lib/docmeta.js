// Per-type document metadata used across list/editor/preview.

export const DOC_META = {
  invoices: {
    singular: 'Invoice',
    plural: 'Invoices',
    dueLabel: 'Payment Due',
    partyLabel: 'Bill To',
    partySource: 'clients',
    kind: 'invoice', // invoice-family form
  },
  estimates: {
    singular: 'Estimate',
    plural: 'Estimates',
    dueLabel: 'Valid Until',
    partyLabel: 'Bill To',
    partySource: 'clients',
    kind: 'invoice',
  },
  'purchase-orders': {
    singular: 'Purchase Order',
    plural: 'Purchase Orders',
    dueLabel: 'Delivery Date',
    partyLabel: 'Vendor / Supplier',
    deliveryLabel: 'Delivery To',
    partySource: 'vendors',
    kind: 'po',
  },
  'work-orders': {
    singular: 'Work Order',
    plural: 'Work Orders',
    dueLabel: 'Delivery Date',
    partyLabel: 'Contractor',
    deliveryLabel: 'Requested By',
    partySource: 'vendors',
    kind: 'po',
  },
  'money-receipt': {
    singular: 'Money Receipt',
    plural: 'Money Receipts',
    partyLabel: 'Cash Received From',
    partySource: 'clients',
    kind: 'receipt',
  },
}

export function metaFor(type) {
  return DOC_META[type]
}
