import { uid, todayISO } from './format.js'
import { previewDocNumber } from './numbering.js'
import { metaFor } from './docmeta.js'

function newLineItem() {
  return { id: uid(), name: '', description: '', spec: '', qty: '', unit: '', rate: '', manualAmount: '' }
}

// Build a fresh document object for a given type. docNumber is generated here
// (which increments the counter) so it must only be called once per new doc.
export function newDocument(type, company) {
  const meta = metaFor(type)
  const base = {
    id: uid(),
    type,
    docNumber: previewDocNumber(type), // provisional; committed at first save
    autoNumber: true, // becomes false if the user edits the number manually
    date: todayISO(),
    currency: type === 'money-receipt' ? 'BDT' : 'USD',
    reference: '',
    status: type === 'money-receipt' ? 'Issued' : 'Draft',
    projectName: '',
    clientCode: '',
    dueDate: '',
    // party
    partyId: '',
    partyName: '',
    contactPerson: '',
    designation: '',
    partyPhone: '',
    partyEmail: '',
    partyAddress: '',
    vatNo: '',
    taxId: '',
    tradeLicense: '',
    // footer snapshot from company
    footer: {
      logo: company?.logo || '',
      name: company?.name || '',
      address: company?.address || '',
      email: company?.email || '',
      phone: company?.phone || '',
      website: company?.website || '',
    },
    notes: '',
    signatures: [{ id: uid(), label: 'Authorized Signature', name: '', designation: '', date: '' }],
    grandTotal: 0,
  }

  if (meta.kind === 'invoice') {
    return {
      ...base,
      items: [newLineItem()],
      discountOn: false,
      discountRate: '',
      aitOn: false,
      aitRate: '',
      vatRate: '',
      bankOn: false,
      bank: { bankName: '', accountName: '', accountNumber: '', branch: '', routing: '', swift: '' },
    }
  }

  if (meta.kind === 'po') {
    return {
      ...base,
      items: [newLineItem()],
      showSpec: true,
      paymentTerms: '',
      deliveryTo: '',
      discountOn: false,
      discountRate: '',
      aitOn: false,
      aitRate: '',
      vatRate: '',
      milestones: [{ id: uid(), description: '', percentage: '' }],
    }
  }

  // money-receipt
  return {
    ...base,
    receivedAmount: '',
    paymentPurpose: '',
    paymentMethod: 'Cash',
    bankName: '',
    branch: '',
    transactionType: '',
    chequeNo: '',
    refNo: '',
    transactionDate: '',
  }
}

export { newLineItem }
