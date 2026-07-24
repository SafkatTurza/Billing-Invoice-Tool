// Money Receipt skin — renders through the SAME shared shell, header, footer,
// signature blocks and multi-page machinery as the Invoice/Estimate/PO/WO skins
// (see DocSkin.jsx), so the Money Receipt visually belongs to the same Paynox
// document family. Only the BODY differs: instead of line items + totals it
// shows Receipt Information, Payment Method, dynamic Transaction Details,
// optional Remarks, and the Authorized Signatures.
//
// The document stores its own independent snapshot (footer, party, amounts), so
// nothing here mutates any master record. References to a linked Invoice /
// Project / Work Order are resolved read-only from the documents array.

import { amountInWords } from '../../lib/amountInWords.js'
import { formatMoneyCode, formatDate } from '../../lib/format.js'
import {
  SkinShell,
  SkinHeader,
  SigsBoxed,
  plainLabel,
  accentLabel,
  ACC,
} from './DocSkin.jsx'

// Canonical payment methods shown as the print-friendly checkbox row.
const METHODS = ['Cash', 'Cheque', 'Bank Transfer', 'BEFTN', 'Other']

// Map any stored payment-method string onto one canonical bucket. Order matters:
// "BEFTN Payment" must match BEFTN before the generic bank/other fall-through,
// and unknown methods (e.g. "Online / MFS", "Card") fall back to "Other".
function methodKey(raw) {
  const s = (raw || '').toLowerCase()
  if (!s) return 'Cash'
  if (s.includes('cash')) return 'Cash'
  if (s.includes('cheque') || s.includes('check')) return 'Cheque'
  if (s.includes('beftn')) return 'BEFTN'
  if (s.includes('bank transfer') || s.includes('wire') || s.includes('transfer')) return 'Bank Transfer'
  return 'Other'
}

// The transaction fields relevant to each method. Empty values are filtered out
// by the caller, so an irrelevant or blank field is simply omitted (never shown
// as "N/A"). Cheque/Bank-Transfer/BEFTN get their own field sets; Cash and
// Other show only whatever data actually exists.
function txnRows(key, doc) {
  const D = (v) => (v ? formatDate(v) : '')
  const sets = {
    Cash: [
      ['Transaction Date', D(doc.transactionDate)],
      ['Reference', doc.refNo],
    ],
    Cheque: [
      ['Bank Name', doc.bankName],
      ['Branch', doc.branch],
      ['Cheque No.', doc.chequeNo],
      ['Cheque Date', D(doc.transactionDate)],
      ['Reference', doc.refNo],
    ],
    'Bank Transfer': [
      ['Bank Name', doc.bankName],
      ['Branch', doc.branch],
      ['Transaction Type', doc.transactionType],
      ['Transaction Ref.', doc.refNo],
      ['Transaction Date', D(doc.transactionDate)],
    ],
    Other: [
      ['Bank Name', doc.bankName],
      ['Branch', doc.branch],
      ['Transaction Type', doc.transactionType],
      ['Cheque No.', doc.chequeNo],
      ['Reference', doc.refNo],
      ['Transaction Date', D(doc.transactionDate)],
    ],
  }
  sets.BEFTN = sets['Bank Transfer']
  return (sets[key] || []).filter(([, v]) => v)
}

// Resolve linked Invoice / Project / Work Order references from the actual
// records. Falls back to the receipt's own stored reference / projectName.
// Only returns values that exist — callers hide rows with no data.
function resolveLinks(doc, docs) {
  const all = Array.isArray(docs) ? docs : []
  const inv = doc.relatedInvoiceId ? all.find((d) => d.id === doc.relatedInvoiceId) : null
  const wo = doc.relatedWorkOrderId ? all.find((d) => d.id === doc.relatedWorkOrderId) : null
  return {
    invoiceRef: (inv && inv.docNumber) || doc.reference || '',
    project: doc.projectName || (inv && inv.projectName) || '',
    workOrderRef: (wo && wo.docNumber) || doc.workOrderRef || '',
  }
}

// Build the model the shared header/footer read, plus the receipt-specific body
// data. Mirrors buildDocModel() in DocSkin so SkinHeader/SkinShell work as-is.
export function buildReceiptModel(doc, brand, font, template, docs) {
  const cur = doc.currency || 'BDT'
  const amount = Number(doc.receivedAmount) || 0
  const f = doc.footer || {}
  const links = resolveLinks(doc, docs)
  const key = methodKey(doc.paymentMethod)
  return {
    doc,
    BC: brand,
    DF: font,
    tpl: template || 'modern',
    cur,
    f,
    label: 'Money Receipt',
    // The logo already carries the company branding in the header, so the
    // receipt header omits the separate company-name line (avoids the duplicate
    // that also appears in the footer). Other document families keep their
    // header subtitle unchanged.
    hideHeaderName: true,
    // Header top-right shows the received amount (prominent), code-formatted.
    headerTotalLabel: 'Received Amount',
    headerAmount: formatMoneyCode(amount, cur),
    grand: amount,
    // Receipt Information
    receivedFrom: doc.partyName || '',
    amountText: formatMoneyCode(amount, cur),
    amountWords: amountInWords(amount, cur),
    purpose: doc.paymentPurpose || '',
    links,
    // Payment method + dynamic transaction details
    methodKey: key,
    methodRaw: doc.paymentMethod || '',
    txn: txnRows(key, doc),
    remarks: doc.notes || '',
  }
}

// A label/value definition row — rendered only when a value exists.
function InfoRow({ label, value, valueStyle }) {
  if (!value) return null
  return (
    <tr>
      <td
        style={{
          color: '#64748b',
          fontSize: 11,
          paddingRight: 14,
          paddingBottom: 6,
          whiteSpace: 'nowrap',
          verticalAlign: 'top',
          width: 170,
        }}
      >
        {label}
      </td>
      <td style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', paddingBottom: 6, whiteSpace: 'pre-wrap', ...valueStyle }}>
        {value}
      </td>
    </tr>
  )
}

const SectionHead = ({ children, secLabelStyle }) => (
  <div className="doc-sec-head" style={secLabelStyle}>
    {children}
  </div>
)

// Print-friendly checkbox row — the selected method is ticked, the rest empty.
function PaymentMethodRow({ m, accent }) {
  const showOther = m.methodKey === 'Other' && m.methodRaw && !METHODS.includes(m.methodRaw)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 4 }}>
      {METHODS.map((label) => {
        const on = m.methodKey === label
        return (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: `1.5px solid ${on ? accent : '#94a3b8'}`,
                background: on ? accent : '#fff',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {on ? '✓' : ''}
            </span>
            <span style={{ color: on ? '#1e293b' : '#64748b', fontWeight: on ? 700 : 500 }}>
              {label === 'Other' && showOther ? `Other (${m.methodRaw})` : label}
            </span>
          </span>
        )
      })}
    </div>
  )
}

function ReceiptBody({ m, secLabelStyle, accent }) {
  const { doc, links, txn } = m
  return (
    <>
      {/* Receipt No. + Receipt Date (Receipt Date = date the receipt was issued) */}
      <div className="doc-keep" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 18 }}>
        <div>
          <div style={secLabelStyle}>Receipt No.</div>
          <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{doc.docNumber}</div>
        </div>
        <div>
          <div style={secLabelStyle}>Receipt Date</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{formatDate(doc.date) || '—'}</div>
        </div>
      </div>

      {/* Receipt Information */}
      <div className="doc-keep" style={{ marginBottom: 18 }}>
        <SectionHead secLabelStyle={secLabelStyle}>Receipt Information</SectionHead>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <InfoRow label="Received From" value={m.receivedFrom} valueStyle={{ fontSize: 14, fontWeight: 700 }} />
            <InfoRow
              label="Received Amount"
              value={m.amountText}
              valueStyle={{ fontSize: 18, fontWeight: 800, color: m.BC }}
            />
            <InfoRow label="Amount in Words" value={m.amountWords} valueStyle={{ fontStyle: 'italic', fontWeight: 500, color: accent }} />
            <InfoRow label="Payment Purpose" value={m.purpose} valueStyle={{ fontWeight: 500 }} />
            <InfoRow label="Invoice Reference" value={links.invoiceRef} />
            <InfoRow label="Project" value={links.project} />
            <InfoRow label="Work Order Reference" value={links.workOrderRef} />
          </tbody>
        </table>
      </div>

      {/* Payment Method */}
      <div className="doc-keep" style={{ marginBottom: 18 }}>
        <SectionHead secLabelStyle={secLabelStyle}>Payment Method</SectionHead>
        <PaymentMethodRow m={m} accent={accent} />
      </div>

      {/* Transaction Details — only when the method actually carries data */}
      {txn.length > 0 && (
        <div className="doc-keep" style={{ marginBottom: 18 }}>
          <SectionHead secLabelStyle={secLabelStyle}>Transaction Details</SectionHead>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {txn.map(([label, value]) => (
                <InfoRow key={label} label={label} value={value} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Remarks — only when provided; height grows naturally with content */}
      {m.remarks && (
        <div className="doc-keep" style={{ marginBottom: 18 }}>
          <SectionHead secLabelStyle={secLabelStyle}>Remarks</SectionHead>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.remarks}</div>
        </div>
      )}

      {/* Authorized Signatures — identical component/behaviour to the Invoice */}
      <SigsBoxed m={m} accent={accent} />
    </>
  )
}

export default function ReceiptSkin({ doc, brand, font, template, docs }) {
  const m = buildReceiptModel(doc, brand, font, template, docs)
  const secLabelStyle = m.tpl === 'simple' ? plainLabel : accentLabel
  const accent = m.tpl === 'simple' ? m.BC : ACC
  return (
    <SkinShell
      m={m}
      header={<SkinHeader m={m} />}
      body={<ReceiptBody m={m} secLabelStyle={secLabelStyle} accent={accent} />}
    />
  )
}
