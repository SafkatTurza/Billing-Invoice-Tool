// ─────────────────────────────────────────────────────────────────────────────
// Demo dataset builder — a self-contained, interconnected sample company.
//
// Everything here is FICTIONAL. Every record is tagged `demo: true` and carries
// a `demo-…` id so the seed/reset mechanism (demoSeed.js) can add or remove the
// demo data without ever touching a real record. Nothing in this file runs at
// startup — it is only invoked when a Super Admin/Admin clicks "Seed Demo Data".
//
// The data tells seven different client stories end-to-end:
//   Client → Estimate → Work Order → Invoice → Payment → Money Receipt
// on the sales side, and
//   Requisition → Purchase Order → Bill / Voucher → Payment
// on the purchase side — plus daily expenses, income/investment, recurring
// entries and the ledger transactions that make the dashboards light up.
//
// Financial figures use the SAME calculation the app uses at save time
// (calcTotals), so every grand total, tax and VAT figure is exactly what the
// editor would have produced. Finance ledger rows mirror what the finance
// context posts on approve/record, so the Finance Dashboard, Ledger and Reports
// compute naturally from real underlying rows — no hard-coded totals anywhere.
// ─────────────────────────────────────────────────────────────────────────────

import { calcTotals } from './pricing.js'

export const DEMO = true // marker value stamped onto every demo record

// Default masters seeded by the app (FinanceContext) — we reference their ids
// rather than creating masters, so a user's own accounts/heads are never touched.
const ACC = { cash: 'a-cash', bank: 'a-bank', bkash: 'a-bkash', nagad: 'a-nagad' }
const HEAD = {
  income: 'h-income',
  service: 'h-service',
  invest: 'h-invest',
  operational: 'h-operational',
  admin: 'h-admin',
  utilities: 'h-utilities',
  transport: 'h-transport',
  salary: 'h-salary',
  marketing: 'h-marketing',
  misc: 'h-misc',
}

const isoAt = (date, t = '10:00:00') => `${date}T${t}.000Z`

// Company footer snapshot printed on documents (cosmetic; the live company
// profile is used elsewhere). Kept generic so it reads well in previews.
const FOOTER = {
  logo: '',
  name: 'DreamCore Studio',
  address: 'Level 7, Tech Tower, Gulshan-1, Dhaka 1212, Bangladesh',
  email: 'billing@dreamcore.studio',
  phone: '+880 1700-000000',
  website: 'www.dreamcore.studio',
}

// A line item in the shape LineItems expects. Pass rate for auto-calc lines, or
// amount (with rate omitted) for a manual fixed-price line (e.g. milestones).
function li(name, { qty = '', rate = '', amount, unit = '', desc = '', spec = '' } = {}) {
  return {
    id: 'demo-li-' + Math.random().toString(36).slice(2, 9),
    name,
    description: desc,
    spec,
    qty: qty === '' ? '' : String(qty),
    unit,
    rate: rate === '' ? '' : String(rate),
    manualAmount: amount != null ? String(amount) : '',
  }
}

// ── Parties ─────────────────────────────────────────────────────────────────

// 7 fictional client companies, each a different industry/story.
const CLIENTS = [
  {
    id: 'demo-cli-apex',
    code: 'DCS26-RE-APX-001',
    field: 'RE',
    name: 'Apex Properties Ltd.',
    address: 'Plot 42, Gulshan Avenue, Gulshan-2, Dhaka 1212, Bangladesh',
    phone: '+880 1711-204512',
    email: 'projects@apexproperties.com.bd',
    vatNo: 'BIN-000482913-0102',
    taxId: 'TIN-482913004521',
    tradeLicense: 'TRAD/DNCC/084213/2019',
    contacts: [
      { id: 'demo-ct-apex1', name: 'Rezaul Karim', designation: 'Head of Sales & Marketing', phone: '+880 1711-204513', email: 'rezaul.karim@apexproperties.com.bd' },
    ],
  },
  {
    id: 'demo-cli-nova',
    code: 'DCS26-AD-NOV-002',
    field: 'AD',
    name: 'Nova Retail Group',
    address: 'House 15, Road 27, Banani, Dhaka 1213, Bangladesh',
    phone: '+880 1811-556677',
    email: 'digital@novaretail.com.bd',
    vatNo: 'BIN-000771254-0203',
    taxId: 'TIN-771254118820',
    tradeLicense: 'TRAD/DNCC/117742/2020',
    contacts: [
      { id: 'demo-ct-nova1', name: 'Tahmina Sultana', designation: 'E-Commerce Director', phone: '+880 1811-556678', email: 'tahmina@novaretail.com.bd' },
    ],
  },
  {
    id: 'demo-cli-horizon',
    code: 'DCS26-GEN-HHL-003',
    field: 'GEN',
    name: 'Horizon Healthcare Ltd.',
    address: 'Medisphere Tower, Panthapath, Dhaka 1215, Bangladesh',
    phone: '+880 1911-330099',
    email: 'training@horizonhealth.com.bd',
    vatNo: 'BIN-000913377-0301',
    taxId: 'TIN-913377220145',
    tradeLicense: 'TRAD/DNCC/203318/2018',
    contacts: [
      { id: 'demo-ct-hor1', name: 'Dr. Ashiqur Rahman', designation: 'Director, Clinical Training', phone: '+880 1911-330100', email: 'ashiq@horizonhealth.com.bd' },
    ],
  },
  {
    id: 'demo-cli-vertex',
    code: 'DCS26-GEN-VTX-004',
    field: 'GEN',
    name: 'Vertex Manufacturing Ltd.',
    address: 'Industrial Plot 7, DEPZ, Savar, Dhaka 1349, Bangladesh',
    phone: '+880 1611-889900',
    email: 'it@vertexmfg.com.bd',
    vatNo: 'BIN-000554120-0407',
    taxId: 'TIN-554120667712',
    tradeLicense: 'TRAD/RAJUK/551209/2017',
    contacts: [
      { id: 'demo-ct-ver1', name: 'Shamsul Alam', designation: 'GM, Product Engineering', phone: '+880 1611-889901', email: 'shamsul@vertexmfg.com.bd' },
    ],
  },
  {
    id: 'demo-cli-lumina',
    code: 'DCS26-GD-LUM-005',
    field: 'GD',
    name: 'Lumina Education Group',
    address: 'Knowledge Park, Bashundhara R/A, Dhaka 1229, Bangladesh',
    phone: '+880 1511-445566',
    email: 'edtech@luminaedu.com.bd',
    vatNo: 'BIN-000330891-0509',
    taxId: 'TIN-330891554300',
    tradeLicense: 'TRAD/DNCC/338820/2021',
    contacts: [
      { id: 'demo-ct-lum1', name: 'Farhana Haque', designation: 'Head of Product', phone: '+880 1511-445567', email: 'farhana@luminaedu.com.bd' },
    ],
  },
  {
    id: 'demo-cli-orbit',
    code: 'DCS26-GD-ORB-006',
    field: 'GD',
    name: 'Orbit Entertainment Ltd.',
    address: '221B Frost Street, Shoreditch, London EC2A 4RT, United Kingdom',
    phone: '+44 20 7946 0512',
    email: 'studio@orbitentertainment.co.uk',
    vatNo: 'GB-418 2277 04',
    taxId: 'UTR-4182277041',
    tradeLicense: 'CRN-11820447',
    contacts: [
      { id: 'demo-ct-orb1', name: 'Daniel Whitmore', designation: 'Executive Producer', phone: '+44 20 7946 0513', email: 'daniel@orbitentertainment.co.uk' },
    ],
  },
  {
    id: 'demo-cli-greenfield',
    code: 'DCS26-RE-GFH-007',
    field: 'RE',
    name: 'GreenField Holdings Ltd.',
    address: 'Corporate Plaza, Level 12, Kawran Bazar, Dhaka 1215, Bangladesh',
    phone: '+880 1322-778811',
    email: 'projects@greenfieldholdings.com.bd',
    vatNo: 'BIN-000660214-0611',
    taxId: 'TIN-660214883077',
    tradeLicense: 'TRAD/DNCC/440921/2016',
    contacts: [
      { id: 'demo-ct-grn1', name: 'Nasrin Akter', designation: 'Head of Corporate Affairs', phone: '+880 1322-778812', email: 'nasrin@greenfieldholdings.com.bd' },
    ],
  },
]

const clientById = Object.fromEntries(CLIENTS.map((c) => [c.id, c]))

// 6 fictional vendors for the purchase side.
const VENDORS = [
  {
    id: 'demo-ven-technoserve', code: 'DCS26-VN-TSH-001', field: 'GEN', name: 'TechnoServe Hardware Ltd.',
    address: 'Multiplan Center, Elephant Road, Dhaka 1205', phone: '+880 1730-112233', email: 'sales@technoserve.com.bd',
    vatNo: 'BIN-000121887-0701', taxId: 'TIN-121887330091', tradeLicense: 'TRAD/DSCC/771120/2015', contacts: [],
  },
  {
    id: 'demo-ven-cloudnexus', code: 'DCS26-VN-CNH-002', field: 'IT', name: 'CloudNexus Hosting BD',
    address: 'Software Technology Park, Janata Tower, Kawran Bazar, Dhaka 1215', phone: '+880 1730-445566', email: 'billing@cloudnexus.com.bd',
    vatNo: 'BIN-000998210-0702', taxId: 'TIN-998210447120', tradeLicense: 'TRAD/DNCC/882013/2019', contacts: [],
  },
  {
    id: 'demo-ven-pixelforge', code: 'DCS26-VN-PFS-003', field: '3D', name: 'PixelForge 3D Studio',
    address: 'Level 4, Creative Hub, Dhanmondi 27, Dhaka 1209', phone: '+880 1730-778899', email: 'hello@pixelforge3d.com',
    vatNo: 'BIN-000442019-0703', taxId: 'TIN-442019880021', tradeLicense: 'TRAD/DNCC/119284/2020', contacts: [],
  },
  {
    id: 'demo-ven-officeplus', code: 'DCS26-VN-OPS-004', field: 'GEN', name: 'OfficePlus Supplies',
    address: 'Shop 22, New Market, Dhaka 1205', phone: '+880 1730-101202', email: 'orders@officeplus.com.bd',
    vatNo: 'BIN-000220145-0704', taxId: 'TIN-220145667001', tradeLicense: 'TRAD/DSCC/553012/2018', contacts: [],
  },
  {
    id: 'demo-ven-bright', code: 'DCS26-VN-BUF-005', field: 'GEN', name: 'Bright Utilities & Facilities',
    address: 'Service Center, Tejgaon I/A, Dhaka 1208', phone: '+880 1730-303404', email: 'accounts@brightfacilities.com.bd',
    vatNo: 'BIN-000771203-0705', taxId: 'TIN-771203009912', tradeLicense: 'TRAD/DNCC/667120/2017', contacts: [],
  },
  {
    id: 'demo-ven-nimbus', code: 'DCS26-VN-NSS-006', field: 'IT', name: 'Nimbus Software Services',
    address: 'Suite 9, Bay Edgewater, Gulshan-1, Dhaka 1212', phone: '+880 1730-505606', email: 'subscriptions@nimbussoft.io',
    vatNo: 'BIN-000330012-0706', taxId: 'TIN-330012554488', tradeLicense: 'TRAD/DNCC/990021/2021', contacts: [],
  },
]

// ── Sales document factories ─────────────────────────────────────────────────

// Common base shared by every sales document (mirrors newDocument()).
function salesBase({ id, type, docNumber, date, currency = 'BDT', status, client, projectName, reference = '', dueDate = '' }) {
  const c = client
  return {
    id,
    type,
    companyId: 'co-1',
    docNumber,
    autoNumber: false,
    date,
    currency,
    reference,
    status,
    projectName,
    clientCode: c?.code || '',
    dueDate,
    partyId: c?.id || '',
    partyName: c?.name || '',
    contactPerson: c?.contacts?.[0]?.name || '',
    designation: c?.contacts?.[0]?.designation || '',
    partyPhone: c?.phone || '',
    partyEmail: c?.email || '',
    partyAddress: c?.address || '',
    vatNo: c?.vatNo || '',
    taxId: c?.taxId || '',
    tradeLicense: c?.tradeLicense || '',
    footer: FOOTER,
    notes: '',
    signatures: [{ id: 'demo-sig-' + id, label: 'Prepared By', name: 'DreamCore Studio', designation: 'Accounts', date }],
    grandTotal: 0,
    demo: true,
    createdAt: isoAt(date),
    updatedAt: isoAt(date),
    createdBy: 'demo',
    createdByName: 'Demo Data',
  }
}

// Invoice / Estimate family (kind: invoice).
function invoiceDoc(opts) {
  const { items, discountOn = false, discountRate = '', aitOn = false, aitRate = '', vatRate = '', notes = '' } = opts
  const doc = {
    ...salesBase(opts),
    items,
    discountOn,
    discountRate: discountRate === '' ? '' : String(discountRate),
    aitOn,
    aitRate: aitRate === '' ? '' : String(aitRate),
    vatRate: vatRate === '' ? '' : String(vatRate),
    bankOn: false,
    bank: { bankName: '', accountName: '', accountNumber: '', branch: '', routing: '', swift: '' },
    notes,
  }
  doc.grandTotal = calcTotals(doc).grandTotal
  return doc
}

// Purchase Order / Work Order family (kind: po).
function poDoc(opts) {
  const { items, deliveryTo = '', paymentTerms = '', milestones = [], notes = '' } = opts
  const doc = {
    ...salesBase(opts),
    items,
    showSpec: true,
    paymentTerms,
    deliveryTo,
    discountOn: false,
    discountRate: '',
    aitOn: false,
    aitRate: '',
    vatRate: '',
    milestones: milestones.length ? milestones : [{ id: 'demo-ms-' + opts.id, description: '', percentage: '' }],
    notes,
  }
  doc.grandTotal = calcTotals(doc).grandTotal
  return doc
}

// Money Receipt (kind: receipt).
function receiptDoc(opts) {
  const { receivedAmount, paymentPurpose, paymentMethod = 'Bank Transfer', bankName = '', branch = '', refNo = '', transactionType = '', chequeNo = '', transactionDate = '' } = opts
  const doc = {
    ...salesBase({ ...opts, type: 'money-receipt', status: 'Issued' }),
    receivedAmount: String(receivedAmount),
    paymentPurpose,
    paymentMethod,
    bankName,
    branch,
    transactionType,
    chequeNo,
    refNo,
    transactionDate: transactionDate || opts.date,
  }
  doc.grandTotal = Number(receivedAmount) || 0
  return doc
}

// ── The seven sales stories ──────────────────────────────────────────────────

function buildSalesDocs() {
  const docs = []
  const apex = clientById['demo-cli-apex']
  const nova = clientById['demo-cli-nova']
  const horizon = clientById['demo-cli-horizon']
  const vertex = clientById['demo-cli-vertex']
  const lumina = clientById['demo-cli-lumina']
  const orbit = clientById['demo-cli-orbit']
  const green = clientById['demo-cli-greenfield']

  // ── Company 1 · Apex Properties — Completed, Fully Paid (no tax) ────────────
  const apexProject = 'Interactive Property Sales Application'
  docs.push(
    invoiceDoc({
      id: 'demo-est-apex', type: 'estimates', docNumber: 'EST-20260112-001', date: '2026-01-12',
      status: 'Approved', client: apex, projectName: apexProject, dueDate: '2026-01-31',
      notes: 'Design and development of an interactive property sales application: project browsing, unit-availability visualization, interactive map, iPad + kiosk apps and CMS connectivity.',
      items: [
        li('UI/UX Design', { qty: 1, rate: 180000, desc: 'Wireframes, hi-fi mockups & interactive prototype' }),
        li('Interactive Map Development', { qty: 1, rate: 250000, desc: 'Zoomable master-plan with live unit availability' }),
        li('CMS Development', { qty: 1, rate: 200000, desc: 'Headless CMS for units, pricing & media' }),
        li('iPad Application Development', { qty: 1, rate: 300000, desc: 'Native sales-team presentation app' }),
        li('Kiosk Application Development', { qty: 1, rate: 220000, desc: 'Touch kiosk for sales-center walk-ins' }),
        li('API Integration', { qty: 1, rate: 150000, desc: 'CRM & inventory sync' }),
        li('Testing & QA', { qty: 1, rate: 100000 }),
        li('Deployment', { qty: 1, rate: 50000 }),
      ],
    }),
  )
  docs.push(
    poDoc({
      id: 'demo-wo-apex', type: 'work-orders', docNumber: 'WO-20260118-001', date: '2026-01-18',
      status: 'Approved', client: apex, projectName: apexProject, reference: 'EST-20260112-001', dueDate: '2026-04-30',
      deliveryTo: 'Apex Sales Center, Gulshan-2',
      notes: 'Authorised against approved estimate EST-20260112-001. Work completed and delivered.',
      items: [
        li('Full build — Interactive Property Sales Application', { qty: 1, rate: 1450000, desc: 'UI/UX, interactive map, CMS, iPad & kiosk apps, API integration, QA, deployment' }),
      ],
      milestones: [{ id: 'demo-ms-apex', description: 'Delivery & deployment', percentage: '100' }],
    }),
  )
  docs.push(
    invoiceDoc({
      id: 'demo-inv-apex', type: 'invoices', docNumber: 'INV-20260430-001', date: '2026-04-30',
      status: 'Paid', client: apex, projectName: apexProject, reference: 'WO-20260118-001', dueDate: '2026-05-15',
      notes: 'Final invoice — project delivered in full. Paid via bank transfer.',
      items: [
        li('UI/UX Design', { qty: 1, rate: 180000 }),
        li('Interactive Map Development', { qty: 1, rate: 250000 }),
        li('CMS Development', { qty: 1, rate: 200000 }),
        li('iPad Application Development', { qty: 1, rate: 300000 }),
        li('Kiosk Application Development', { qty: 1, rate: 220000 }),
        li('API Integration', { qty: 1, rate: 150000 }),
        li('Testing & QA', { qty: 1, rate: 100000 }),
        li('Deployment', { qty: 1, rate: 50000 }),
      ],
    }),
  )
  docs.push(
    receiptDoc({
      id: 'demo-mr-apex', docNumber: 'MR-20260508-001', date: '2026-05-08', client: apex,
      projectName: apexProject, reference: 'INV-20260430-001', receivedAmount: 1450000,
      paymentPurpose: 'Full & final payment for Interactive Property Sales Application (INV-20260430-001)',
      paymentMethod: 'Bank Transfer', bankName: 'BRAC Bank', branch: 'Gulshan', refNo: 'BFT-2605-778120',
    }),
  )
  // A follow-on maintenance retainer — a second Paid invoice + receipt (enriches history).
  docs.push(
    invoiceDoc({
      id: 'demo-inv-apex-maint', type: 'invoices', docNumber: 'INV-20260601-006', date: '2026-06-01',
      status: 'Paid', client: apex, projectName: apexProject + ' — Maintenance', reference: 'INV-20260430-001', dueDate: '2026-06-15',
      notes: 'Quarterly maintenance & support retainer.',
      items: [li('Maintenance & Support (Q2)', { qty: 3, unit: 'month', rate: 25000, desc: 'Bug fixes, minor enhancements, uptime monitoring' })],
    }),
  )
  docs.push(
    receiptDoc({
      id: 'demo-mr-apex-maint', docNumber: 'MR-20260610-006', date: '2026-06-10', client: apex,
      projectName: apexProject + ' — Maintenance', reference: 'INV-20260601-006', receivedAmount: 75000,
      paymentPurpose: 'Maintenance retainer Q2 (INV-20260601-006)', paymentMethod: 'Online / MFS', bankName: '', refNo: 'BKASH-TX-99120',
    }),
  )

  // ── Company 2 · Nova Retail — Active, Partially Paid (discount + AIT + VAT) ──
  const novaProject = 'AR Product Visualization Application'
  docs.push(
    invoiceDoc({
      id: 'demo-est-nova', type: 'estimates', docNumber: 'EST-20260205-002', date: '2026-02-05',
      status: 'Approved', client: nova, projectName: novaProject, dueDate: '2026-02-28',
      notes: 'AR product-visualization app: markerless placement of 3D products in the shopper’s space, catalog sync and analytics.',
      items: [
        li('UI/UX Design', { qty: 1, rate: 120000 }),
        li('AR Application Development', { qty: 1, rate: 350000, desc: 'Markerless AR placement (iOS + Android)' }),
        li('3D Product Modeling', { qty: 20, unit: 'model', rate: 9000, desc: 'PBR-textured hero products' }),
        li('Backend Integration', { qty: 1, rate: 200000, desc: 'Catalog & inventory service' }),
        li('API Integration', { qty: 1, rate: 90000 }),
        li('Testing & QA', { qty: 1, rate: 60000 }),
      ],
      discountOn: true, discountRate: 5, aitOn: true, aitRate: 5, vatRate: 7.5,
    }),
  )
  docs.push(
    poDoc({
      id: 'demo-wo-nova', type: 'work-orders', docNumber: 'WO-20260212-002', date: '2026-02-12',
      status: 'Approved', client: nova, projectName: novaProject, reference: 'EST-20260205-002', dueDate: '2026-08-31',
      deliveryTo: 'Nova Retail HQ, Banani',
      notes: 'Project in progress. Advance invoiced; remaining balance on delivery.',
      items: [li('AR Product Visualization Application — full build', { qty: 1, rate: 820000 })],
      milestones: [
        { id: 'demo-ms-nova1', description: 'Advance', percentage: '40' },
        { id: 'demo-ms-nova2', description: 'On delivery', percentage: '60' },
      ],
    }),
  )
  // Full-value invoice, partially paid (advance received) → status Partial, outstanding balance.
  const novaInv = invoiceDoc({
    id: 'demo-inv-nova', type: 'invoices', docNumber: 'INV-20260215-002', date: '2026-02-15',
    status: 'Partial', client: nova, projectName: novaProject, reference: 'WO-20260212-002', dueDate: '2026-03-15',
    notes: 'Project invoice. 40% advance received; balance due on delivery.',
    items: [
      li('UI/UX Design', { qty: 1, rate: 120000 }),
      li('AR Application Development', { qty: 1, rate: 350000 }),
      li('3D Product Modeling', { qty: 20, unit: 'model', rate: 9000 }),
      li('Backend Integration', { qty: 1, rate: 200000 }),
      li('API Integration', { qty: 1, rate: 90000 }),
      li('Testing & QA', { qty: 1, rate: 60000 }),
    ],
    discountOn: true, discountRate: 5, aitOn: true, aitRate: 5, vatRate: 7.5,
  })
  docs.push(novaInv)
  docs.push(
    receiptDoc({
      id: 'demo-mr-nova', docNumber: 'MR-20260220-002', date: '2026-02-20', client: nova,
      projectName: novaProject, reference: 'INV-20260215-002', receivedAmount: 430000,
      paymentPurpose: '40% advance against INV-20260215-002', paymentMethod: 'Bank Transfer', bankName: 'City Bank', branch: 'Banani', refNo: 'CBL-2602-330145',
    }),
  )
  // A phase-2 estimate still in Draft — shows the Draft status.
  docs.push(
    invoiceDoc({
      id: 'demo-est-nova-p2', type: 'estimates', docNumber: 'EST-20260701-008', date: '2026-07-01',
      status: 'Draft', client: nova, projectName: novaProject + ' — Phase 2 (Analytics)', dueDate: '2026-07-31',
      notes: 'Draft quote for a phase-2 analytics dashboard. Not yet sent.',
      items: [
        li('Analytics Dashboard', { qty: 1, rate: 180000 }),
        li('Recommendation Engine Integration', { qty: 1, rate: 140000 }),
      ],
    }),
  )

  // ── Company 3 · Horizon Healthcare — Estimate awaiting approval (Sent) ───────
  const horizonProject = 'VR Training Simulation'
  docs.push(
    invoiceDoc({
      id: 'demo-est-horizon', type: 'estimates', docNumber: 'EST-20260620-003', date: '2026-06-20',
      status: 'Sent', client: horizon, projectName: horizonProject, dueDate: '2026-07-20',
      notes: 'VR clinical-training simulation: immersive OT environment, guided procedures and competency scoring. Awaiting client approval.',
      items: [
        li('VR Application Development', { qty: 1, rate: 600000, desc: 'Meta Quest build, guided interactions' }),
        li('3D Environment Development', { qty: 1, rate: 350000, desc: 'Operating-theatre environment' }),
        li('Character Animation', { qty: 1, rate: 220000, desc: 'Patient & staff rigs and animations' }),
        li('Interaction Development', { qty: 1, rate: 260000 }),
        li('Training Modules', { qty: 4, unit: 'module', rate: 75000, desc: 'Procedure scenarios with scoring' }),
        li('Testing & QA', { qty: 1, rate: 90000 }),
        li('Deployment', { qty: 1, rate: 60000 }),
      ],
      aitOn: true, aitRate: 5, vatRate: 7.5,
    }),
  )
  // A rejected alternative quote — shows the Rejected status.
  docs.push(
    invoiceDoc({
      id: 'demo-est-horizon-alt', type: 'estimates', docNumber: 'EST-20260601-007', date: '2026-06-01',
      status: 'Rejected', client: horizon, projectName: horizonProject + ' — Premium option', dueDate: '2026-06-30',
      notes: 'Premium scope with haptics. Client rejected in favour of the standard scope.',
      items: [
        li('VR Application Development (Premium)', { qty: 1, rate: 900000 }),
        li('Haptic Glove Integration', { qty: 1, rate: 400000 }),
      ],
      aitOn: true, aitRate: 5, vatRate: 7.5,
    }),
  )

  // ── Company 4 · Vertex Manufacturing — Approved, Invoice Unpaid (Sent) ───────
  const vertexProject = 'Interactive 3D Product Configurator'
  docs.push(
    invoiceDoc({
      id: 'demo-est-vertex', type: 'estimates', docNumber: 'EST-20260310-004', date: '2026-03-10',
      status: 'Approved', client: vertex, projectName: vertexProject, dueDate: '2026-03-31',
      notes: 'Web-based 3D product configurator with real-time pricing and quote generation.',
      items: [
        li('3D Product Modeling', { qty: 12, unit: 'model', rate: 15000 }),
        li('Web Application Development', { qty: 1, rate: 320000 }),
        li('Product Configuration System', { qty: 1, rate: 260000, desc: 'Rules engine + real-time pricing' }),
        li('Backend Development', { qty: 1, rate: 210000 }),
        li('API Integration', { qty: 1, rate: 110000 }),
        li('Testing & QA', { qty: 1, rate: 80000 }),
        li('Deployment', { qty: 1, rate: 50000 }),
      ],
      aitOn: true, aitRate: 5, vatRate: 7.5,
    }),
  )
  docs.push(
    poDoc({
      id: 'demo-wo-vertex', type: 'work-orders', docNumber: 'WO-20260318-004', date: '2026-03-18',
      status: 'Approved', client: vertex, projectName: vertexProject, reference: 'EST-20260310-004', dueDate: '2026-06-30',
      deliveryTo: 'Vertex Manufacturing, DEPZ Savar',
      items: [li('Interactive 3D Product Configurator — full build', { qty: 1, rate: 1130000 })],
      milestones: [{ id: 'demo-ms-vertex', description: 'On delivery', percentage: '100' }],
    }),
  )
  docs.push(
    invoiceDoc({
      id: 'demo-inv-vertex', type: 'invoices', docNumber: 'INV-20260625-004', date: '2026-06-25',
      status: 'Sent', client: vertex, projectName: vertexProject, reference: 'WO-20260318-004', dueDate: '2026-08-10',
      notes: 'Delivered and invoiced. Payment pending (not yet due).',
      items: [
        li('3D Product Modeling', { qty: 12, unit: 'model', rate: 15000 }),
        li('Web Application Development', { qty: 1, rate: 320000 }),
        li('Product Configuration System', { qty: 1, rate: 260000 }),
        li('Backend Development', { qty: 1, rate: 210000 }),
        li('API Integration', { qty: 1, rate: 110000 }),
        li('Testing & QA', { qty: 1, rate: 80000 }),
        li('Deployment', { qty: 1, rate: 50000 }),
      ],
      aitOn: true, aitRate: 5, vatRate: 7.5,
    }),
  )

  // ── Company 5 · Lumina Education — Milestone project (30/40/30) ──────────────
  // Project total 1,500,000 exactly. Each milestone invoice is a single manual
  // line so the totals reconcile precisely: 450,000 + 600,000 + 450,000.
  const luminaProject = 'Educational Game Development'
  docs.push(
    invoiceDoc({
      id: 'demo-est-lumina', type: 'estimates', docNumber: 'EST-20260220-005', date: '2026-02-20',
      status: 'Approved', client: lumina, projectName: luminaProject, dueDate: '2026-03-10',
      notes: 'Cross-platform educational game: game design, 2D/3D assets, animation, sound and QA. Total project value BDT 1,500,000 billed across three milestones (30% / 40% / 30%).',
      items: [
        li('Game Design & Learning Framework', { qty: 1, rate: 240000 }),
        li('UI/UX', { qty: 1, rate: 160000 }),
        li('Game Development', { qty: 1, rate: 520000 }),
        li('2D/3D Asset Development', { qty: 1, rate: 260000 }),
        li('Animation', { qty: 1, rate: 140000 }),
        li('Sound Integration', { qty: 1, rate: 80000 }),
        li('QA & Deployment', { qty: 1, rate: 100000 }),
      ],
    }),
  )
  docs.push(
    poDoc({
      id: 'demo-wo-lumina', type: 'work-orders', docNumber: 'WO-20260225-005', date: '2026-02-25',
      status: 'Approved', client: lumina, projectName: luminaProject, reference: 'EST-20260220-005', dueDate: '2026-08-15',
      deliveryTo: 'Lumina Education Group, Bashundhara R/A',
      items: [li('Educational Game Development — milestone-based build', { qty: 1, rate: 1500000 })],
      milestones: [
        { id: 'demo-ms-lum1', description: '30% Advance', percentage: '30' },
        { id: 'demo-ms-lum2', description: '40% Mid-project', percentage: '40' },
        { id: 'demo-ms-lum3', description: '30% Final', percentage: '30' },
      ],
    }),
  )
  docs.push(
    invoiceDoc({
      id: 'demo-inv-lumina-1', type: 'invoices', docNumber: 'INV-20260301-005', date: '2026-03-01',
      status: 'Paid', client: lumina, projectName: luminaProject, reference: 'WO-20260225-005', dueDate: '2026-03-15',
      notes: 'Milestone 1 of 3 — 30% advance. Paid.',
      items: [li('Milestone 1 — 30% Advance (Educational Game Development)', { amount: 450000 })],
    }),
  )
  docs.push(
    receiptDoc({
      id: 'demo-mr-lumina-1', docNumber: 'MR-20260306-005', date: '2026-03-06', client: lumina,
      projectName: luminaProject, reference: 'INV-20260301-005', receivedAmount: 450000,
      paymentPurpose: 'Milestone 1 (30% advance) — INV-20260301-005', paymentMethod: 'Cheque', bankName: 'Dutch-Bangla Bank', branch: 'Bashundhara', chequeNo: 'A/2214477', transactionType: 'Account Payee',
    }),
  )
  docs.push(
    invoiceDoc({
      id: 'demo-inv-lumina-2', type: 'invoices', docNumber: 'INV-20260510-005', date: '2026-05-10',
      status: 'Paid', client: lumina, projectName: luminaProject, reference: 'WO-20260225-005', dueDate: '2026-05-25',
      notes: 'Milestone 2 of 3 — 40% mid-project. Paid.',
      items: [li('Milestone 2 — 40% Mid-project (Educational Game Development)', { amount: 600000 })],
    }),
  )
  docs.push(
    receiptDoc({
      id: 'demo-mr-lumina-2', docNumber: 'MR-20260516-005', date: '2026-05-16', client: lumina,
      projectName: luminaProject, reference: 'INV-20260510-005', receivedAmount: 600000,
      paymentPurpose: 'Milestone 2 (40% mid-project) — INV-20260510-005', paymentMethod: 'Bank Transfer', bankName: 'Dutch-Bangla Bank', branch: 'Bashundhara', refNo: 'DBBL-2605-551209',
    }),
  )
  docs.push(
    invoiceDoc({
      id: 'demo-inv-lumina-3', type: 'invoices', docNumber: 'INV-20260710-005', date: '2026-07-10',
      status: 'Sent', client: lumina, projectName: luminaProject, reference: 'WO-20260225-005', dueDate: '2026-08-20',
      notes: 'Milestone 3 of 3 — 30% final. Awaiting final delivery sign-off.',
      items: [li('Milestone 3 — 30% Final (Educational Game Development)', { amount: 450000 })],
    }),
  )

  // ── Company 6 · Orbit Entertainment — Ongoing (USD, partially paid) ──────────
  const orbitProject = 'Multiplayer Game Prototype'
  docs.push(
    invoiceDoc({
      id: 'demo-est-orbit', type: 'estimates', docNumber: 'EST-20260408-006', date: '2026-04-08', currency: 'USD',
      status: 'Approved', client: orbit, projectName: orbitProject, dueDate: '2026-04-30',
      notes: 'Unity-based multiplayer game prototype: core loop, authoritative netcode, 3D assets and character animation.',
      items: [
        li('Game Design', { qty: 1, rate: 6000 }),
        li('Unity Development', { qty: 1, rate: 18000 }),
        li('Multiplayer Integration', { qty: 1, rate: 14000, desc: 'Authoritative server + matchmaking' }),
        li('Backend Integration', { qty: 1, rate: 8000 }),
        li('3D Assets', { qty: 1, rate: 7000 }),
        li('Character Animation', { qty: 1, rate: 5000 }),
        li('Testing', { qty: 1, rate: 3000 }),
      ],
    }),
  )
  docs.push(
    poDoc({
      id: 'demo-wo-orbit', type: 'work-orders', docNumber: 'WO-20260415-006', date: '2026-04-15', currency: 'USD',
      status: 'Approved', client: orbit, projectName: orbitProject, reference: 'EST-20260408-006', dueDate: '2026-09-30',
      deliveryTo: 'Orbit Entertainment, London (remote)',
      notes: 'Prototype in active development. Advance invoiced.',
      items: [li('Multiplayer Game Prototype — build', { qty: 1, rate: 61000 })],
      milestones: [
        { id: 'demo-ms-orbit1', description: 'Advance', percentage: '50' },
        { id: 'demo-ms-orbit2', description: 'On prototype delivery', percentage: '50' },
      ],
    }),
  )
  docs.push(
    invoiceDoc({
      id: 'demo-inv-orbit', type: 'invoices', docNumber: 'INV-20260418-006', date: '2026-04-18', currency: 'USD',
      status: 'Partial', client: orbit, projectName: orbitProject, reference: 'WO-20260415-006', dueDate: '2026-05-18',
      notes: 'Advance invoice for the prototype. 50% received; balance on delivery.',
      items: [
        li('Game Design', { qty: 1, rate: 6000 }),
        li('Unity Development', { qty: 1, rate: 18000 }),
        li('Multiplayer Integration', { qty: 1, rate: 14000 }),
        li('Backend Integration', { qty: 1, rate: 8000 }),
        li('3D Assets', { qty: 1, rate: 7000 }),
        li('Character Animation', { qty: 1, rate: 5000 }),
        li('Testing', { qty: 1, rate: 3000 }),
      ],
    }),
  )
  docs.push(
    receiptDoc({
      id: 'demo-mr-orbit', docNumber: 'MR-20260424-006', date: '2026-04-24', client: orbit, currency: 'USD',
      projectName: orbitProject, reference: 'INV-20260418-006', receivedAmount: 30500,
      paymentPurpose: '50% advance against INV-20260418-006', paymentMethod: 'Bank Transfer', bankName: 'Wise', branch: 'London', refNo: 'WISE-P28841003',
    }),
  )

  // ── Company 7 · GreenField Holdings — Completed but Overdue ──────────────────
  const greenProject = 'Corporate Virtual Tour Platform'
  docs.push(
    invoiceDoc({
      id: 'demo-est-green', type: 'estimates', docNumber: 'EST-20260128-007', date: '2026-01-28',
      status: 'Approved', client: green, projectName: greenProject, dueDate: '2026-02-15',
      notes: '360° corporate virtual-tour platform with CMS-managed hotspots, 3D visualization and hosting.',
      items: [
        li('360° Virtual Tour Production', { qty: 8, unit: 'space', rate: 45000 }),
        li('3D Visualization', { qty: 1, rate: 220000 }),
        li('Web Application', { qty: 1, rate: 300000 }),
        li('CMS Development', { qty: 1, rate: 180000 }),
        li('Hosting Setup', { qty: 1, rate: 60000 }),
        li('Testing', { qty: 1, rate: 70000 }),
      ],
      aitOn: true, aitRate: 5, vatRate: 7.5,
    }),
  )
  docs.push(
    poDoc({
      id: 'demo-wo-green', type: 'work-orders', docNumber: 'WO-20260203-007', date: '2026-02-03',
      status: 'Approved', client: green, projectName: greenProject, reference: 'EST-20260128-007', dueDate: '2026-04-15',
      deliveryTo: 'GreenField Holdings, Kawran Bazar',
      notes: 'Delivered and deployed. Final invoice issued; payment overdue.',
      items: [li('Corporate Virtual Tour Platform — full build', { qty: 1, rate: 1190000 })],
      milestones: [{ id: 'demo-ms-green', description: 'On delivery', percentage: '100' }],
    }),
  )
  docs.push(
    invoiceDoc({
      id: 'demo-inv-green', type: 'invoices', docNumber: 'INV-20260415-007', date: '2026-04-15',
      status: 'Overdue', client: green, projectName: greenProject, reference: 'WO-20260203-007', dueDate: '2026-05-15',
      notes: 'Final invoice — delivered in full. Payment past due; follow-up in progress.',
      items: [
        li('360° Virtual Tour Production', { qty: 8, unit: 'space', rate: 45000 }),
        li('3D Visualization', { qty: 1, rate: 220000 }),
        li('Web Application', { qty: 1, rate: 300000 }),
        li('CMS Development', { qty: 1, rate: 180000 }),
        li('Hosting Setup', { qty: 1, rate: 60000 }),
        li('Testing', { qty: 1, rate: 70000 }),
      ],
      aitOn: true, aitRate: 5, vatRate: 7.5,
    }),
  )

  // ── Purchase Orders to vendors (kind: po, party = vendor) ────────────────────
  const poToVendor = (id, docNumber, date, status, vendor, projectName, dueDate, items, notes) =>
    poDoc({
      id, type: 'purchase-orders', docNumber, date, status,
      client: vendor, projectName, dueDate, deliveryTo: 'DreamCore Studio, Gulshan-1', notes,
      items, paymentTerms: 'Net 15',
    })
  const techno = VENDORS[0]
  const cloud = VENDORS[1]
  const pixel = VENDORS[2]
  const office = VENDORS[3]
  docs.push(
    poToVendor('demo-po-tech1', 'PO-20260205-001', '2026-02-05', 'Approved', techno, 'Workstation refresh', '2026-02-15',
      [
        li('Developer Laptop — 32GB / RTX', { qty: 4, unit: 'pc', rate: 165000 }),
        li('4K Monitor 27"', { qty: 6, unit: 'pc', rate: 42000 }),
      ], 'Hardware for the AR/VR delivery team. Against requisition DCS-REQ-2602-1.'),
  )
  docs.push(
    poToVendor('demo-po-tech2', 'PO-20260318-002', '2026-03-18', 'Approved', techno, 'VR lab equipment', '2026-03-28',
      [
        li('VR Headset — Meta Quest 3', { qty: 5, unit: 'pc', rate: 78000 }),
        li('VR-ready Backpack PC', { qty: 2, unit: 'pc', rate: 210000 }),
      ], 'For the Horizon Healthcare VR simulation. Against requisition DCS-REQ-2603-3.'),
  )
  docs.push(
    poToVendor('demo-po-cloud', 'PO-20260401-003', '2026-04-01', 'Approved', cloud, 'Annual cloud hosting', '2026-04-05',
      [li('Cloud Hosting — Production cluster (annual)', { qty: 1, unit: 'year', rate: 360000 })],
      'Managed hosting for client deployments (annual pre-pay).'),
  )
  docs.push(
    poToVendor('demo-po-pixel', 'PO-20260620-004', '2026-06-20', 'Sent', pixel, '3D asset outsourcing', '2026-07-10',
      [li('Outsourced 3D Product Models', { qty: 15, unit: 'model', rate: 12000 })],
      'Overflow 3D modeling for the Nova Retail AR project. Awaiting vendor confirmation.'),
  )
  docs.push(
    poToVendor('demo-po-office', 'PO-20260710-005', '2026-07-10', 'Draft', office, 'Office furniture', '2026-07-25',
      [
        li('Ergonomic Chair', { qty: 8, unit: 'pc', rate: 18500 }),
        li('Standing Desk', { qty: 4, unit: 'pc', rate: 32000 }),
      ], 'New-hire seating. Draft — pending budget sign-off.'),
  )

  return docs
}

// ── Finance side: requisitions, vouchers, bills, expenses, income + ledger ────

function financeSlots(labels, signedCount, date) {
  return labels.map((label, i) => ({
    label,
    signed: i < signedCount,
    signerName: i < signedCount ? 'Demo Approver' : undefined,
    signedAt: i < signedCount ? isoAt(date) : undefined,
  }))
}

function finBase({ id, type, docNumber, date, status, currency = 'BDT' }) {
  return {
    id,
    type,
    companyId: 'co-1',
    docNumber,
    autoNumber: false,
    date,
    currency,
    fxRate: '',
    status,
    notes: '',
    attachments: [],
    signSlots: [],
    timeline: [],
    demo: true,
    createdAt: isoAt(date),
    updatedAt: isoAt(date),
    createdBy: 'demo',
    createdByName: 'Demo Data',
  }
}

function buildFinance() {
  const finDocs = []
  const ledger = []
  // Post a ledger row exactly as the finance context would on approve/record.
  const post = ({ date, direction, amount, currency = 'BDT', accountId, headId, partyName, description, linkType, linkId, docNumber, transactionId }) => {
    ledger.push({
      id: 'demo-txn-' + linkId + '-' + ledger.length,
      createdAt: isoAt(date),
      createdBy: 'demo',
      status: 'posted',
      txnDate: date,
      direction,
      amount,
      baseAmount: amount, // all finance rows are BDT here, so base == amount
      currency,
      fxRate: 1,
      accountId: accountId || null,
      headId: headId || null,
      partyName: partyName || '',
      description: description || '',
      linkType,
      linkId,
      docNumber: docNumber || '',
      companyId: 'co-1',
      transactionId: transactionId || null,
      demo: true,
    })
  }

  // ── Income / Investment (money IN) — funds the accounts & shows revenue ──────
  const incomes = [
    { id: 'demo-inc-capital', docNumber: 'INC-2601-001', date: '2026-01-05', kind: 'investment', head: HEAD.invest, acc: ACC.bank, amount: 6000000, party: 'DreamCore Studio (Owners)', desc: 'Capital injection — working capital for FY2026' },
    { id: 'demo-inc-cashfloat', docNumber: 'INC-2601-002', date: '2026-01-06', kind: 'investment', head: HEAD.invest, acc: ACC.cash, amount: 400000, party: 'DreamCore Studio (Owners)', desc: 'Petty-cash float' },
    { id: 'demo-inc-mfsfloat', docNumber: 'INC-2601-003', date: '2026-01-06', kind: 'investment', head: HEAD.invest, acc: ACC.bkash, amount: 150000, party: 'DreamCore Studio (Owners)', desc: 'MFS wallet float' },
    { id: 'demo-inc-apex', docNumber: 'INC-2605-004', date: '2026-05-08', kind: 'income', head: HEAD.service, acc: ACC.bank, amount: 1450000, party: 'Apex Properties Ltd.', desc: 'Billing income deposited — INV-20260430-001' },
    { id: 'demo-inc-lumina1', docNumber: 'INC-2603-005', date: '2026-03-06', kind: 'income', head: HEAD.service, acc: ACC.bank, amount: 450000, party: 'Lumina Education Group', desc: 'Milestone 1 received — INV-20260301-005' },
    { id: 'demo-inc-lumina2', docNumber: 'INC-2605-006', date: '2026-05-16', kind: 'income', head: HEAD.service, acc: ACC.bank, amount: 600000, party: 'Lumina Education Group', desc: 'Milestone 2 received — INV-20260510-005' },
    { id: 'demo-inc-nova', docNumber: 'INC-2602-007', date: '2026-02-20', kind: 'income', head: HEAD.service, acc: ACC.bank, amount: 430000, party: 'Nova Retail Group', desc: 'Advance received — INV-20260215-002' },
  ]
  for (const it of incomes) {
    finDocs.push({
      ...finBase({ id: it.id, type: 'income', docNumber: it.docNumber, date: it.date, status: 'Recorded' }),
      kind: it.kind, headId: it.head, accountId: it.acc, amount: it.amount, party: it.party, description: it.desc,
    })
    post({ date: it.date, direction: 'in', amount: it.amount, accountId: it.acc, headId: it.head, partyName: it.party, description: it.desc, linkType: 'income', linkId: it.id, docNumber: it.docNumber })
  }

  // ── Requisitions (approvable; different statuses) ────────────────────────────
  const REQ_SLOTS = ['Proposed By', 'Checked By', 'Authorised By']
  const reqs = [
    { id: 'demo-req-1', docNumber: 'DCS-REQ-2602-1', date: '2026-02-03', status: 'Approved', signed: 3, title: 'Developer workstations (4×)', dept: 'Engineering', items: [['Developer Laptop — 32GB/RTX', 4, 165000], ['4K Monitor 27"', 6, 42000]], remark: 'Fulfilled by PO-20260205-001.' },
    { id: 'demo-req-2', docNumber: 'DCS-REQ-2603-2', date: '2026-03-15', status: 'Approved', signed: 3, title: 'VR lab equipment', dept: 'XR Team', items: [['Meta Quest 3 headset', 5, 78000], ['VR-ready Backpack PC', 2, 210000]], remark: 'Fulfilled by PO-20260318-002.' },
    { id: 'demo-req-3', docNumber: 'DCS-REQ-2604-3', date: '2026-04-01', status: 'Approved', signed: 3, title: 'Annual cloud hosting', dept: 'DevOps', items: [['Cloud hosting — annual', 1, 360000]], remark: 'Fulfilled by PO-20260401-003.' },
    { id: 'demo-req-4', docNumber: 'DCS-REQ-2606-4', date: '2026-06-18', status: 'Pending Approval', signed: 2, title: 'Outsourced 3D modeling', dept: 'Art', items: [['Outsourced 3D models', 15, 12000]], remark: 'Awaiting management authorisation.' },
    { id: 'demo-req-5', docNumber: 'DCS-REQ-2607-5', date: '2026-07-08', status: 'Pending Approval', signed: 1, title: 'Software licenses renewal', dept: 'Engineering', items: [['IDE & design tool licenses', 12, 9500]], remark: 'Checker review pending.' },
    { id: 'demo-req-6', docNumber: 'DCS-REQ-2607-6', date: '2026-07-15', status: 'Draft', signed: 0, title: 'Office furniture (new hires)', dept: 'Admin', items: [['Ergonomic chair', 8, 18500], ['Standing desk', 4, 32000]], remark: 'Draft — pending budget confirmation.' },
    { id: 'demo-req-7', docNumber: 'DCS-REQ-2605-7', date: '2026-05-20', status: 'Rejected', signed: 1, title: 'Conference travel (overseas)', dept: 'Management', items: [['Overseas conference — 2 pax', 2, 320000]], remark: 'Rejected — deferred to next quarter.' },
  ]
  for (const r of reqs) {
    const items = r.items.map(([title, qty, rate], i) => ({
      id: `${r.id}-it${i}`, title, description: '', qty: String(qty), calcAmount: String(qty * rate), finalAmount: String(qty * rate), remarks: '',
    }))
    const total = items.reduce((s, it) => s + Number(it.finalAmount), 0)
    finDocs.push({
      ...finBase({ id: r.id, type: 'requisition', docNumber: r.docNumber, date: r.date, status: r.status }),
      title: r.title, department: r.dept, requester: 'Demo Data', items, total,
      notes: r.remark, signSlots: financeSlots(REQ_SLOTS, r.signed, r.date),
      timeline: [{ id: r.id + '-tl', at: isoAt(r.date), byId: 'demo', byName: 'Demo Data', action: 'created', detail: '' }],
    })
  }

  // ── Vouchers (approved ones post to the ledger) ──────────────────────────────
  const V_SLOTS = ['Accountant', 'Checked By', 'Managing Director/Director', 'Received Payments']
  const vouchers = [
    { id: 'demo-v-1', docNumber: 'PV-20260210-001', date: '2026-02-10', vtype: 'payment', method: 'Bank Transfer', head: HEAD.operational, acc: ACC.bank, amount: 912000, payee: 'TechnoServe Hardware Ltd.', purpose: 'Payment for workstations (PO-20260205-001)', req: 'DCS-REQ-2602-1' },
    { id: 'demo-v-2', docNumber: 'PV-20260320-002', date: '2026-03-20', vtype: 'payment', method: 'Bank Transfer', head: HEAD.operational, acc: ACC.bank, amount: 810000, payee: 'TechnoServe Hardware Ltd.', purpose: 'Payment for VR lab equipment (PO-20260318-002)', req: 'DCS-REQ-2603-2' },
    { id: 'demo-v-3', docNumber: 'PV-20260405-003', date: '2026-04-05', vtype: 'payment', method: 'BEFTN', head: HEAD.utilities, acc: ACC.bank, amount: 360000, payee: 'CloudNexus Hosting BD', purpose: 'Annual cloud hosting (PO-20260401-003)', req: 'DCS-REQ-2604-3' },
    { id: 'demo-v-4', docNumber: 'DV-20260430-004', date: '2026-04-30', vtype: 'debit', method: 'Bank Transfer', head: HEAD.salary, acc: ACC.bank, amount: 620000, payee: 'Payroll — April 2026', purpose: 'Monthly salary disbursement (April)' },
    { id: 'demo-v-5', docNumber: 'PV-20260518-005', date: '2026-05-18', vtype: 'payment', method: 'Cheque', head: HEAD.operational, acc: ACC.bank, amount: 180000, payee: 'PixelForge 3D Studio', purpose: 'Outsourced 3D work — partial advance' },
    { id: 'demo-v-6', docNumber: 'CV-20260706-006', date: '2026-07-06', vtype: 'cash', cashDir: 'payment', method: 'Cash', head: HEAD.admin, acc: ACC.cash, amount: 24000, payee: 'Team offsite', purpose: 'Team offsite refreshments & venue' },
    { id: 'demo-v-7', docNumber: 'PV-20260715-007', date: '2026-07-15', vtype: 'payment', method: 'BEFTN', head: HEAD.salary, acc: ACC.bank, amount: 640000, payee: 'Payroll — July 2026', purpose: 'Monthly salary disbursement (July)' },
    { id: 'demo-v-8', docNumber: 'PV-20260712-008', date: '2026-07-12', vtype: 'payment', method: 'Online / MFS', head: HEAD.marketing, acc: ACC.bkash, amount: 35000, payee: 'Social Reach Agency', purpose: 'Digital marketing — July campaign' },
    // A pending voucher (not yet approved → does NOT post to the ledger).
    { id: 'demo-v-9', docNumber: 'PV-20260718-009', date: '2026-07-18', vtype: 'payment', method: 'Bank Transfer', head: HEAD.operational, acc: ACC.bank, amount: 144000, payee: 'PixelForge 3D Studio', purpose: 'Outsourced 3D work — balance', status: 'Pending Approval', signed: 2 },
    // A cash RECEIPT voucher (money IN) — e.g. refund from a vendor.
    { id: 'demo-v-10', docNumber: 'CV-20260620-010', date: '2026-06-20', vtype: 'cash', cashDir: 'receipt', method: 'Cash', head: HEAD.income, acc: ACC.cash, amount: 18000, payee: 'TechnoServe Hardware Ltd.', purpose: 'Refund — returned faulty monitor' },
  ]
  for (const v of vouchers) {
    const status = v.status || 'Approved'
    const signedCount = v.status ? (v.signed ?? 2) : 3 // approved → through management slot
    finDocs.push({
      ...finBase({ id: v.id, type: 'voucher', docNumber: v.docNumber, date: v.date, status }),
      voucherType: v.vtype,
      cashDirection: v.cashDir || 'payment',
      financialRole: 'primary',
      transactionId: '',
      paymentMethod: v.method,
      headId: v.head,
      accountId: v.acc,
      amount: v.amount,
      lines: [],
      receivedFrom: v.payee,
      purpose: v.purpose,
      requisitionNumber: v.req || '',
      signSlots: financeSlots(V_SLOTS, signedCount, v.date),
      timeline: [{ id: v.id + '-tl', at: isoAt(v.date), byId: 'demo', byName: 'Demo Data', action: 'created', detail: '' }],
    })
    if (status === 'Approved') {
      const dir = v.vtype === 'cash' && v.cashDir === 'receipt' ? 'in' : 'out'
      post({ date: v.date, direction: dir, amount: v.amount, accountId: v.acc, headId: v.head, partyName: v.payee, description: v.purpose, linkType: 'voucher', linkId: v.id, docNumber: v.docNumber })
    }
  }

  // ── Bills / Payables (payment status derived from payments[]) ────────────────
  const bills = [
    // Paid in full
    { id: 'demo-bill-1', docNumber: 'BILL-2602-001', date: '2026-02-06', due: '2026-02-20', vendor: 'TechnoServe Hardware Ltd.', head: HEAD.operational, amount: 912000, billRef: 'TSH-INV-4471', desc: 'Workstations & monitors', pays: [['2026-02-18', 912000, ACC.bank]] },
    { id: 'demo-bill-2', docNumber: 'BILL-2604-002', date: '2026-04-02', due: '2026-04-05', vendor: 'CloudNexus Hosting BD', head: HEAD.utilities, amount: 360000, billRef: 'CNH-2026-0091', desc: 'Annual hosting', pays: [['2026-04-05', 360000, ACC.bank]] },
    // Partially paid
    { id: 'demo-bill-3', docNumber: 'BILL-2605-003', date: '2026-05-15', due: '2026-06-15', vendor: 'PixelForge 3D Studio', head: HEAD.operational, amount: 324000, billRef: 'PFS-0261', desc: 'Outsourced 3D modeling (27 models)', pays: [['2026-05-18', 180000, ACC.bank]] },
    // Open, not yet due (future)
    { id: 'demo-bill-4', docNumber: 'BILL-2607-004', date: '2026-07-14', due: '2026-08-14', vendor: 'Nimbus Software Services', head: HEAD.admin, amount: 114000, billRef: 'NSS-SUB-7781', desc: 'Software subscriptions renewal (annual)', pays: [] },
    { id: 'demo-bill-5', docNumber: 'BILL-2607-005', date: '2026-07-20', due: '2026-08-20', vendor: 'OfficePlus Supplies', head: HEAD.admin, amount: 276000, billRef: 'OPS-2231', desc: 'Office furniture (chairs & desks)', pays: [] },
    // Overdue (past due, unpaid)
    { id: 'demo-bill-6', docNumber: 'BILL-2606-006', date: '2026-06-01', due: '2026-06-30', vendor: 'Bright Utilities & Facilities', head: HEAD.utilities, amount: 48000, billRef: 'BUF-JUN-1120', desc: 'Electricity & facilities — June', pays: [] },
    // Overdue (partially paid, past due)
    { id: 'demo-bill-7', docNumber: 'BILL-2605-007', date: '2026-05-05', due: '2026-06-05', vendor: 'Bright Utilities & Facilities', head: HEAD.utilities, amount: 52000, billRef: 'BUF-MAY-0980', desc: 'Electricity & facilities — May', pays: [['2026-05-28', 20000, ACC.bank]] },
  ]
  for (const b of bills) {
    const payments = b.pays.map(([date, amount, accountId], i) => ({ id: `${b.id}-p${i}`, date, amount, accountId, note: '', txnId: `demo-txn-${b.id}-p${i}` }))
    finDocs.push({
      ...finBase({ id: b.id, type: 'bill', docNumber: b.docNumber, date: b.date, status: 'Recorded' }),
      vendorName: b.vendor, billRef: b.billRef, dueDate: b.due, headId: b.head, amount: b.amount, description: b.desc, payments,
    })
    for (const [date, amount, accountId] of b.pays) {
      post({ date, direction: 'out', amount, accountId, headId: b.head, partyName: b.vendor, description: `Bill payment — ${b.billRef}`, linkType: 'bill', linkId: b.id, docNumber: b.docNumber })
    }
  }

  // ── Daily Expenses (recorded → ledger 'out') ─────────────────────────────────
  // Small day-to-day costs. Several dated in July 2026 so the Finance Dashboard's
  // "this month" figures and expense-by-head chart are populated.
  const exp = [
    ['demo-exp-1', 'EXP-2601-001', '2026-01-09', HEAD.utilities, ACC.bank, 8500, 'Internet & broadband — January', 'Bright Utilities & Facilities'],
    ['demo-exp-2', 'EXP-2601-002', '2026-01-20', HEAD.transport, ACC.cash, 4200, 'Courier & delivery', 'Sundry'],
    ['demo-exp-3', 'EXP-2602-003', '2026-02-08', HEAD.utilities, ACC.bank, 9100, 'Electricity bill — February', 'Bright Utilities & Facilities'],
    ['demo-exp-4', 'EXP-2602-004', '2026-02-14', HEAD.admin, ACC.cash, 6500, 'Office supplies & stationery', 'OfficePlus Supplies'],
    ['demo-exp-5', 'EXP-2603-005', '2026-03-05', HEAD.admin, ACC.cash, 12000, 'Team refreshments', 'Sundry'],
    ['demo-exp-6', 'EXP-2603-006', '2026-03-22', HEAD.transport, ACC.bkash, 5400, 'Ride-share for client meetings', 'Sundry'],
    ['demo-exp-7', 'EXP-2604-007', '2026-04-10', HEAD.utilities, ACC.bank, 8700, 'Internet & broadband — April', 'Bright Utilities & Facilities'],
    ['demo-exp-8', 'EXP-2604-008', '2026-04-19', HEAD.admin, ACC.cash, 7800, 'Office maintenance & cleaning', 'Sundry'],
    ['demo-exp-9', 'EXP-2605-009', '2026-05-07', HEAD.marketing, ACC.bkash, 15000, 'Social media boost', 'Social Reach Agency'],
    ['demo-exp-10', 'EXP-2605-010', '2026-05-23', HEAD.transport, ACC.cash, 3900, 'Courier — contracts dispatch', 'Sundry'],
    ['demo-exp-11', 'EXP-2606-011', '2026-06-06', HEAD.utilities, ACC.bank, 9300, 'Electricity bill — June', 'Bright Utilities & Facilities'],
    ['demo-exp-12', 'EXP-2606-012', '2026-06-17', HEAD.admin, ACC.cash, 5200, 'Pantry & refreshments', 'Sundry'],
    ['demo-exp-13', 'EXP-2607-013', '2026-07-03', HEAD.utilities, ACC.bank, 8900, 'Internet & broadband — July', 'Bright Utilities & Facilities'],
    ['demo-exp-14', 'EXP-2607-014', '2026-07-07', HEAD.transport, ACC.cash, 4600, 'Ride-share — client visits', 'Sundry'],
    ['demo-exp-15', 'EXP-2607-015', '2026-07-11', HEAD.admin, ACC.cash, 6800, 'Office supplies', 'OfficePlus Supplies'],
    ['demo-exp-16', 'EXP-2607-016', '2026-07-14', HEAD.admin, ACC.cash, 9500, 'Team lunch — sprint close', 'Sundry'],
    ['demo-exp-17', 'EXP-2607-017', '2026-07-18', HEAD.transport, ACC.bkash, 3200, 'Courier & delivery', 'Sundry'],
    ['demo-exp-18', 'EXP-2607-018', '2026-07-21', HEAD.utilities, ACC.bank, 7400, 'Water & utilities — July', 'Bright Utilities & Facilities'],
  ]
  for (const [id, docNumber, date, head, acc, amount, desc, party] of exp) {
    finDocs.push({
      ...finBase({ id, type: 'expense', docNumber, date, status: 'Recorded' }),
      headId: head, accountId: acc, amount, party, description: desc,
    })
    post({ date, direction: 'out', amount, accountId: acc, headId: head, partyName: party, description: desc, linkType: 'expense', linkId: id, docNumber })
  }

  return { finDocs, ledger }
}

// ── Recurring templates (spawn expenses/bills; no ledger impact until run) ─────
function buildRecurring() {
  return [
    { id: 'demo-rc-1', name: 'Office Rent', kind: 'bill', headId: HEAD.utilities, vendorName: 'GreenField Holdings Ltd.', amount: 120000, currency: 'BDT', dayOfMonth: 1, description: 'Monthly office rent', demo: true },
    { id: 'demo-rc-2', name: 'Internet & Broadband', kind: 'expense', headId: HEAD.utilities, accountId: ACC.bank, vendorName: 'Bright Utilities & Facilities', amount: 8500, currency: 'BDT', dayOfMonth: 5, description: 'Monthly internet', demo: true },
    { id: 'demo-rc-3', name: 'Cloud Hosting', kind: 'bill', headId: HEAD.utilities, vendorName: 'CloudNexus Hosting BD', amount: 30000, currency: 'BDT', dayOfMonth: 3, description: 'Monthly hosting & CDN', demo: true },
    { id: 'demo-rc-4', name: 'Software Subscriptions', kind: 'expense', headId: HEAD.admin, accountId: ACC.bank, vendorName: 'Nimbus Software Services', amount: 22000, currency: 'BDT', dayOfMonth: 10, description: 'Design & dev tool subscriptions', demo: true },
    { id: 'demo-rc-5', name: 'Facilities Maintenance', kind: 'expense', headId: HEAD.admin, accountId: ACC.cash, vendorName: 'Bright Utilities & Facilities', amount: 12000, currency: 'BDT', dayOfMonth: 15, description: 'Cleaning & upkeep', demo: true },
    { id: 'demo-rc-6', name: 'MFS / Cloud Services', kind: 'expense', headId: HEAD.admin, accountId: ACC.bkash, vendorName: 'Nimbus Software Services', amount: 6000, currency: 'BDT', dayOfMonth: 12, description: 'Metered cloud services', demo: true },
  ]
}

// Build the full interconnected dataset. Pure — returns arrays; writes nothing.
export function buildDemoData() {
  const docs = buildSalesDocs()
  const { finDocs, ledger } = buildFinance()
  const recurring = buildRecurring()
  return {
    clients: CLIENTS.map((c) => ({ ...c, demo: true })),
    vendors: VENDORS.map((v) => ({ ...v, demo: true })),
    docs,
    finDocs,
    ledger,
    recurring,
  }
}

// A short, human-readable summary of what a seed will create (for the UI).
export function demoSummary() {
  const { clients, vendors, docs, finDocs, ledger, recurring } = buildDemoData()
  const byType = (arr, t) => arr.filter((d) => d.type === t).length
  return {
    clients: clients.length,
    vendors: vendors.length,
    estimates: byType(docs, 'estimates'),
    workOrders: byType(docs, 'work-orders'),
    invoices: byType(docs, 'invoices'),
    purchaseOrders: byType(docs, 'purchase-orders'),
    moneyReceipts: byType(docs, 'money-receipt'),
    requisitions: byType(finDocs, 'requisition'),
    vouchers: byType(finDocs, 'voucher'),
    bills: byType(finDocs, 'bill'),
    expenses: byType(finDocs, 'expense'),
    income: byType(finDocs, 'income'),
    recurring: recurring.length,
    ledgerRows: ledger.length,
  }
}
