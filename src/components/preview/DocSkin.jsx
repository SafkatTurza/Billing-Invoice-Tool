// Template skin engine — one data model, one information FORMAT, three visual
// designs (Simple · Modern · Flexible), ported from the original Paynox source.
// Renders the printable body for Invoice / Estimate / PO / WO.
//
// All three designs share the exact same document structure and multi-page
// mechanics (a shared shell — see SkinShell); they differ only in styling
// (header treatment, accent colours, item-table look, totals emphasis).

import { calcTotals, lineAmount } from '../../lib/pricing.js'
import { amountInWords } from '../../lib/amountInWords.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { metaFor } from '../../lib/docmeta.js'
import { colVisible, colLabel, nameColKey } from '../../lib/columns.js'

const ACC = '#0d9488'

function money(v, cur) {
  return formatMoney(v, cur)
}

// Normalize a document into the model every skin reads.
export function buildDocModel(doc, brand, font, template) {
  const meta = metaFor(doc.type)
  const cur = doc.currency || 'USD'
  const t = calcTotals(doc)
  const isPO = doc.type === 'purchase-orders' || doc.type === 'work-orders'
  const f = doc.footer || {}

  const partyLines = [
    doc.contactPerson && ['Contact', doc.contactPerson],
    doc.designation && [null, doc.designation],
    doc.partyAddress && ['addr', doc.partyAddress],
    doc.partyPhone && ['Phone', doc.partyPhone],
    doc.partyEmail && ['Email', doc.partyEmail],
    doc.vatNo && ['VAT No', doc.vatNo],
    doc.taxId && ['Tax ID', doc.taxId],
    !isPO && doc.tradeLicense && ['Trade License', doc.tradeLicense],
  ].filter(Boolean)

  const metaRows = (
    isPO
      ? [
          [meta.singular + ' Number', doc.docNumber],
          ['Reference', doc.reference],
          ['Date', formatDate(doc.date)],
          ['Delivery Date', doc.dueDate && formatDate(doc.dueDate)],
          ['Payment Terms', doc.paymentTerms],
          [meta.deliveryLabel, doc.deliveryTo],
          ['Status', doc.status],
          ['Currency', cur],
        ]
      : [
          [meta.singular + ' Number', doc.docNumber],
          ['Reference', doc.reference],
          ['Date', formatDate(doc.date)],
          [meta.dueLabel, doc.dueDate && formatDate(doc.dueDate)],
          ['Status', doc.status],
          ['Project', doc.projectName],
          ['Client Code', doc.clientCode],
          ['Currency', cur],
        ]
  ).filter(([, v]) => v)

  const totalsRows = [
    ['Subtotal', money(t.subtotal, cur), '#64748b', '#1e293b', false],
    ...(doc.discountOn && t.discountAmount > 0
      ? [
          [`Discount (${doc.discountRate || 0}%)`, '- ' + money(t.discountAmount, cur), '#64748b', '#dc2626', false],
          ['After Discount', money(t.afterDiscount, cur), '#64748b', '#1e293b', false],
        ]
      : []),
    ...(doc.aitOn ? [[`AIT/TAX (${doc.aitRate || 0}%)`, '+ ' + money(t.aitAmount, cur), '#64748b', '#059669', false]] : []),
    ...(doc.aitOn ? [[`VAT (${doc.vatRate || 0}%)`, '+ ' + money(t.vatAmount, cur), '#64748b', '#059669', false]] : []),
    // Summary bottom line is always "Total Payable" (matches the reference
    // format); the header top-right keeps the "Grand Total" / "Total" label.
    ['Total Payable', money(t.grandTotal, cur), '#1e293b', brand, true],
  ]

  const hasBank = doc.bankOn && doc.bank && Object.values(doc.bank).some((v) => v)

  return {
    doc,
    meta,
    label: meta.singular,
    BC: brand,
    DF: font,
    tpl: template || 'modern',
    cur,
    f,
    hasBank,
    isPO,
    partyLabel: meta.partyLabel,
    partyName: doc.partyName,
    partyLines,
    metaRows,
    totalsRows,
    grand: t.grandTotal,
    headerTotalLabel: isPO ? 'Total' : 'Grand Total',
  }
}

const PartyLines = ({ lines }) =>
  lines.map(([k, v], i) => (
    <div key={i} style={{ color: '#64748b', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
      {k && k !== 'addr' ? `${k}: ` : ''}
      {v}
    </div>
  ))

const WordsBox = ({ m }) => (
  <div style={{ background: '#f6faf9', border: `1px solid ${m.BC}`, borderRadius: 6, padding: '7px 12px', marginBottom: 14, fontSize: 11 }}>
    <span style={{ color: '#64748b' }}>Amount in Words: </span>
    <span style={{ fontWeight: 500, color: m.BC, fontStyle: 'italic' }}>{amountInWords(m.grand, m.cur)}</span>
  </div>
)

const NotesBlock = ({ m, accent }) => (
  <div>
    <div className="doc-sec-head" style={{ fontSize: 10, fontWeight: 700, color: accent || m.BC, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
      {m.isPO ? 'Notes / Terms' : 'Terms & Conditions'}
    </div>
    <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.doc.notes}</div>
  </div>
)

const BankBlock = ({ m, accent }) => (
  <div>
    <div className="doc-sec-head" style={{ fontSize: 10, fontWeight: 700, color: accent || m.BC, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
      Bank Information
    </div>
    {[
      ['bankName', 'Bank Name'],
      ['accountName', 'Account Name'],
      ['accountNumber', 'Account Number'],
      ['branch', 'Branch'],
      ['routing', 'Routing No'],
      ['swift', 'Swift'],
    ]
      .filter(([k]) => m.doc.bank[k])
      .map(([k, l]) => (
        <div key={k} style={{ display: 'flex', gap: 6, fontSize: 11, marginBottom: 2 }}>
          <span style={{ color: '#64748b', minWidth: 80 }}>{l}</span>
          <span style={{ fontWeight: 500 }}>: {m.doc.bank[k]}</span>
        </div>
      ))}
  </div>
)

const MilestonesBlock = ({ m, accent }) => (
  <div style={{ marginBottom: 14 }}>
    <div className="doc-sec-head" style={{ fontSize: 10, fontWeight: 700, color: accent || m.BC, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
      Payment Milestones
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr style={{ background: '#f8fafc' }}>
          <th style={{ padding: '5px 8px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 10 }}>Milestone</th>
          <th style={{ padding: '5px 8px', textAlign: 'right', color: '#64748b', fontWeight: 600, fontSize: 10, width: 60 }}>%</th>
          <th style={{ padding: '5px 8px', textAlign: 'right', color: '#64748b', fontWeight: 600, fontSize: 10, width: 110 }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {m.doc.milestones.map((ms, i) => (
          <tr key={ms.id} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
            <td style={{ padding: '5px 8px' }}>{ms.description}</td>
            <td style={{ padding: '5px 8px', textAlign: 'right' }}>{ms.percentage}%</td>
            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
              {money((m.grand * (parseFloat(ms.percentage) || 0)) / 100, m.cur)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// "Authorized Signatures" block — shared by every design. Each signatory gets
// its OWN bordered box:
//   • TOP    — label, name, designation + any optional configured info
//   • MIDDLE — blank vertical space for a handwritten signature + company seal
//   • BOTTOM — signature line, "(Sign & Stamp)", and the date
// Layout follows a two-column pattern: 1 signature → one box; 2 → side by side;
// 3 → two on the first row and one on the next; 4 → 2×2; and so on. Each box
// carries `.doc-sig-box` so print rules keep an individual box from splitting
// across a page break. `accent` tints the section label / box labels per design.
export const SigsBoxed = ({ m, accent = ACC }) => {
  const sigs = m.doc.signatures || []
  if (!sigs.length) return null
  const cols = sigs.length === 1 ? 1 : 2
  return (
    <div className="doc-sig-section" style={{ marginTop: 24 }}>
      <div className="doc-sec-head" style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
        Authorized Signatures
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
        {sigs.map((s) => (
          <div
            key={s.id}
            className="doc-sig-box"
            style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column' }}
          >
            {/* TOP — who is signing */}
            <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.6 }}>{s.label}</div>
            {s.name && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginTop: 3 }}>{s.name}</div>}
            {s.designation && <div style={{ fontSize: 10.5, color: '#64748b' }}>{s.designation}</div>}
            {s.showCompany && s.company && <div style={{ fontSize: 10, color: '#64748b' }}>{s.company}</div>}
            {s.showPhone && s.phone && <div style={{ fontSize: 10, color: '#64748b' }}>{s.phone}</div>}
            {s.showEmail && s.email && <div style={{ fontSize: 10, color: '#64748b' }}>{s.email}</div>}
            {/* MIDDLE — room for a physical signature and company stamp */}
            <div style={{ height: 66, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {s.image && <img src={s.image} alt="" style={{ maxHeight: 60, maxWidth: '90%', objectFit: 'contain' }} />}
            </div>
            {/* BOTTOM — signature line, seal caption, date */}
            <div style={{ borderTop: '1px solid #94a3b8', marginTop: 2 }} />
            <div style={{ textAlign: 'center', fontSize: 9.5, color: '#94a3b8', marginTop: 3 }}>(Sign &amp; Stamp)</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 5 }}>Date: {s.date ? formatDate(s.date) : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Company running footer — logo · name · address (left), contact details
// (right). The top border colour follows the design's brand colour.
export const DocFooter = ({ m }) => {
  const f = m.f
  return (
    <div style={{ borderTop: `2px solid ${m.BC}`, margin: '0 24px', padding: '10px 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {f.logo && <img src={f.logo} style={{ height: 32, objectFit: 'contain' }} alt="" />}
        <div>
          {f.name && <div style={{ fontWeight: 700, fontSize: 11, color: '#1e293b' }}>{f.name}</div>}
          {f.address && <div style={{ fontSize: 9.5, color: '#64748b', whiteSpace: 'pre-wrap' }}>{f.address}</div>}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 9.5, color: '#64748b' }}>
        {f.email && <div><span style={{ fontWeight: 600, color: '#475569' }}>Email:</span> {f.email}</div>}
        {f.phone && <div><span style={{ fontWeight: 600, color: '#475569' }}>Phone:</span> {f.phone}</div>}
        {f.website && <div><span style={{ fontWeight: 600, color: '#475569' }}>Visit:</span> {f.website}</div>}
      </div>
    </div>
  )
}

// Bill-To + Document-Details two-column block (first page only — it lives in the
// table body, so it is not repeated on continuation pages). `secLabelStyle`
// styles the "Bill To" / "Document Details" section labels per design.
const Parties = ({ m, secLabelStyle }) => {
  const { partyLabel, partyName, partyLines, metaRows } = m
  return (
    <div className="doc-keep" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 18 }}>
      <div>
        <div style={secLabelStyle}>{partyLabel}</div>
        {partyName && <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: '#1e293b' }}>{partyName}</div>}
        <PartyLines lines={partyLines} />
      </div>
      <div>
        <div style={secLabelStyle}>Document Details</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {metaRows.map(([k, v]) => (
              <tr key={k}>
                <td style={{ color: '#64748b', paddingRight: 6, paddingBottom: 3, fontSize: 11, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{k}</td>
                <td style={{ fontWeight: 600, fontSize: 11, paddingBottom: 3, color: '#1e293b' }}>: {v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Shared body blocks below the financial summary, in the fixed information
// order: Amount in Words → Terms & Conditions (+ Bank) → Milestones →
// Authorized Signatures. `accent` tints section labels per design.
const SkinBlocks = ({ m, accent }) => {
  const showNotes = !!m.doc.notes
  return (
    <div>
      {m.grand > 0 && <WordsBox m={m} />}
      {(showNotes || m.hasBank) && (
        <div style={{ display: 'grid', gridTemplateColumns: showNotes && m.hasBank ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 14 }}>
          {showNotes && <NotesBlock m={m} accent={accent} />}
          {m.hasBank && <BankBlock m={m} accent={accent} />}
        </div>
      )}
      {m.doc.milestones && m.doc.milestones.some((ms) => ms.description || ms.percentage) && (
        <MilestonesBlock m={m} accent={accent} />
      )}
      <SigsBoxed m={m} accent={accent || ACC} />
    </div>
  )
}

const Items = ({ m, headBg, headColor, headBorder, zebra }) => {
  const { doc, cur } = m
  if (!(doc.items && doc.items.length)) return null
  // Respect the same column visibility + custom header labels as the editor.
  const showName = colVisible(doc, 'name')
  const showSpec = showName && colVisible(doc, 'spec')
  const showQty = colVisible(doc, 'qty')
  const showUnit = colVisible(doc, 'unit')
  const showRate = colVisible(doc, 'rate')
  const showDesc = colVisible(doc, 'description')
  const firstKey = nameColKey(doc)
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
      <thead>
        <tr style={{ background: headBg, color: headColor, borderBottom: headBorder || 'none' }}>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: 11, width: 26 }}>#</th>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: 11 }}>{colLabel(doc, firstKey)}</th>
          {showSpec && <th style={{ padding: '8px', textAlign: 'left', fontSize: 11, width: 90 }}>{colLabel(doc, 'spec')}</th>}
          {showQty && <th style={{ padding: '8px', textAlign: 'center', fontSize: 11, width: 50 }}>{colLabel(doc, 'qty')}</th>}
          {showUnit && <th style={{ padding: '8px', textAlign: 'left', fontSize: 11, width: 50 }}>{colLabel(doc, 'unit')}</th>}
          {showRate && <th style={{ padding: '8px', textAlign: 'right', fontSize: 11, width: 90 }}>{colLabel(doc, 'rate')}</th>}
          <th style={{ padding: '8px', textAlign: 'right', fontSize: 11, width: 100 }}>{colLabel(doc, 'amount')}</th>
        </tr>
      </thead>
      <tbody>
        {doc.items.map((item, i) => (
          <tr key={item.id} style={{ background: zebra && i % 2 === 0 ? zebra : '#fff', borderBottom: '1px solid #eef1f5' }}>
            <td style={{ padding: '7px 8px', color: '#94a3b8', textAlign: 'center' }}>{i + 1}</td>
            <td style={{ padding: '7px 8px' }}>
              {showName ? (
                <>
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  {showDesc && item.description && (
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, whiteSpace: 'pre-wrap' }}>{item.description}</div>
                  )}
                </>
              ) : (
                <div style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{item.description}</div>
              )}
            </td>
            {showSpec && <td style={{ padding: '7px 8px', fontSize: 11 }}>{item.spec}</td>}
            {showQty && <td style={{ padding: '7px 8px', textAlign: 'center' }}>{item.qty}</td>}
            {showUnit && <td style={{ padding: '7px 8px' }}>{item.unit}</td>}
            {showRate && <td style={{ padding: '7px 8px', textAlign: 'right' }}>{Number(item.rate) > 0 ? money(item.rate, cur) : '—'}</td>}
            <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600 }}>{money(lineAmount(item), cur)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const Totals = ({ m, boxed }) => (
  <div style={{ width: 290 }}>
    {m.totalsRows.map(([l, v, lc, vc, isGrand], i) =>
      isGrand && boxed ? (
        <div
          key={i}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: m.BC, color: '#fff', padding: '9px 13px', borderRadius: 6, marginTop: 7 }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{l}</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{v}</span>
        </div>
      ) : (
        <div
          key={i}
          style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderTop: isGrand ? `2px solid ${m.BC}` : 'none', marginTop: isGrand ? 4 : 0 }}
        >
          <span style={{ color: lc, fontSize: isGrand ? 13 : 11 }}>{l}</span>
          <span style={{ color: isGrand ? m.BC : vc, fontWeight: isGrand ? 700 : 500, fontSize: isGrand ? 15 : 11 }}>{v}</span>
        </div>
      ),
    )}
  </div>
)

// ── HEADER DESIGNS ───────────────────────────────────────────────────────────
// Every header carries the same information (logo · document label · grand
// total, top-right) so the format is identical; only the styling differs.

// Modern — solid navy bar with a white logo chip.
const HeaderModern = ({ m }) => (
  <div style={{ background: m.BC, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {m.f.logo && (
        <span style={{ background: '#fff', borderRadius: 6, padding: '6px 11px', display: 'inline-flex', alignItems: 'center' }}>
          <img src={m.f.logo} style={{ height: 42, objectFit: 'contain' }} alt="" />
        </span>
      )}
      <span style={{ color: '#fff', fontSize: 25, fontWeight: 800, letterSpacing: 2 }}>{m.label.toUpperCase()}</span>
    </div>
    <div style={{ textAlign: 'right', color: '#fff' }}>
      <div style={{ fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,.75)' }}>{m.headerTotalLabel}</div>
      <div style={{ fontSize: 23, fontWeight: 800, marginTop: 2 }}>{m.headerAmount != null ? m.headerAmount : money(m.grand, m.cur)}</div>
    </div>
  </div>
)

// Simple — clean white header with a coloured baseline rule.
const HeaderSimple = ({ m }) => (
  <div style={{ background: '#fff', borderBottom: `3px solid ${m.BC}`, padding: '18px 24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {m.f.logo && <img src={m.f.logo} style={{ height: 48, objectFit: 'contain' }} alt="" />}
      <div>
        <div style={{ fontSize: 27, fontWeight: 800, color: m.BC, letterSpacing: 0.5, lineHeight: 1 }}>{m.label.toUpperCase()}</div>
        {!m.hideHeaderName && m.f.name && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{m.f.name}</div>}
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: '#94a3b8' }}>{m.headerTotalLabel}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: m.BC, marginTop: 2 }}>{m.headerAmount != null ? m.headerAmount : money(m.grand, m.cur)}</div>
    </div>
  </div>
)

// Flexible — bold two-tone diagonal (brand → teal) banner.
const HeaderFlexible = ({ m }) => (
  <div style={{ background: `linear-gradient(105deg, ${m.BC} 0%, ${m.BC} 50%, ${ACC} 50%, ${ACC} 100%)`, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {m.f.logo && (
        <span style={{ background: '#fff', borderRadius: 6, padding: '6px 11px', display: 'inline-flex', alignItems: 'center' }}>
          <img src={m.f.logo} style={{ height: 42, objectFit: 'contain' }} alt="" />
        </span>
      )}
      <div>
        <div style={{ color: '#fff', fontSize: 23, fontWeight: 800, letterSpacing: 1.5, lineHeight: 1.1 }}>{m.label.toUpperCase()}</div>
        {!m.hideHeaderName && m.f.name && <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 10.5, marginTop: 2 }}>{m.f.name}</div>}
      </div>
    </div>
    <div style={{ textAlign: 'right', color: '#fff' }}>
      <div style={{ fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>{m.headerTotalLabel}</div>
      <div style={{ fontSize: 23, fontWeight: 800, marginTop: 2 }}>{money(m.grand, m.cur)}</div>
    </div>
  </div>
)

// ── SHARED SHELL ─────────────────────────────────────────────────────────────
// The single document structure every design renders through. The whole
// document is wrapped in one table:
//   • <thead> is the branded header — the browser reprints it at the top of
//     every printed page and reserves its height per page, so the header shows
//     on EVERY page and body content never rides under it.
//   • <tfoot> reprints on every page too and reserves a footer-height band at
//     the bottom of each page. In print it is made invisible (its height kept)
//     and the real footer is painted by `.doc-print-footer`, pinned to the
//     physical page bottom — so the footer sits flush at the bottom of EVERY
//     page. On screen the tfoot shows the footer once, at the end.
//   • <tbody> holds the single-appearance content (Bill To / Document Details,
//     line items, financial summary, amount-in-words, terms, signatures).
// This guarantees the identical information format and correct multi-page PDF
// output across all three designs.
export function SkinShell({ m, header, body }) {
  const { DF } = m
  return (
    <div className="doc-shell">
      <table className="doc-running" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: `"${DF}", sans-serif`, fontSize: 12, color: '#1e293b', background: '#fff' }}>
        <thead className="doc-running-head">
          <tr>
            <td style={{ padding: 0 }}>{header}</td>
          </tr>
        </thead>
        <tfoot className="doc-running-foot">
          <tr>
            <td style={{ padding: 0 }}>
              <DocFooter m={m} />
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td style={{ padding: 0, verticalAlign: 'top' }}>
              <div style={{ padding: '18px 24px 6px' }}>{body}</div>
            </td>
          </tr>
        </tbody>
      </table>
      {/* Print-only: the real footer pinned to the bottom of every printed page. */}
      <div className="doc-print-footer">
        <DocFooter m={m} />
      </div>
    </div>
  )
}

// Pick the header design for a given model's template — reused by every document
// family (Invoice / Estimate / PO / WO / Money Receipt) so the branded header
// treatment is identical across the whole document family.
export function SkinHeader({ m }) {
  if (m.tpl === 'simple') return <HeaderSimple m={m} />
  if (m.tpl === 'flexible') return <HeaderFlexible m={m} />
  return <HeaderModern m={m} />
}

// The invoice/estimate/PO/WO body: parties, line items, totals, then the shared
// blocks (amount in words, terms, milestones, signatures).
function InvoiceBody({ m, itemsProps, totalsBoxed, secLabelStyle, accent }) {
  return (
    <>
      <Parties m={m} secLabelStyle={secLabelStyle} />
      <Items m={m} {...itemsProps} />
      <div className="doc-keep" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Totals m={m} boxed={totalsBoxed} />
      </div>
      <SkinBlocks m={m} accent={accent} />
    </>
  )
}

// Section-label styles per design (Bill To / Document Details headings) — also
// reused by the Money Receipt skin so its section headings match.
export const plainLabel = { fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }
export const accentLabel = { fontSize: 10, fontWeight: 700, color: ACC, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, paddingBottom: 4, borderBottom: `1.5px solid ${ACC}` }
export { ACC }

// ── SKIN 1 · SIMPLE ──  minimal, monochrome brand
function SkinSimple({ m }) {
  return (
    <SkinShell
      m={m}
      header={<HeaderSimple m={m} />}
      body={
        <InvoiceBody
          m={m}
          itemsProps={{ headBg: '#fff', headColor: m.BC, headBorder: `2px solid ${m.BC}`, zebra: '#f8fafc' }}
          totalsBoxed={false}
          secLabelStyle={plainLabel}
          accent={m.BC}
        />
      }
    />
  )
}

// ── SKIN 2 · MODERN ──  navy header, teal accents (reference format)
function SkinModern({ m }) {
  return (
    <SkinShell
      m={m}
      header={<HeaderModern m={m} />}
      body={
        <InvoiceBody
          m={m}
          itemsProps={{ headBg: m.BC, headColor: '#fff', zebra: '#fafafa' }}
          totalsBoxed={false}
          secLabelStyle={accentLabel}
          accent={ACC}
        />
      }
    />
  )
}

// ── SKIN 3 · FLEXIBLE ──  two-tone banner, boxed grand total
function SkinFlexible({ m }) {
  return (
    <SkinShell
      m={m}
      header={<HeaderFlexible m={m} />}
      body={
        <InvoiceBody
          m={m}
          itemsProps={{ headBg: m.BC, headColor: '#fff', zebra: '#f5f7fa' }}
          totalsBoxed
          secLabelStyle={accentLabel}
          accent={ACC}
        />
      }
    />
  )
}

export default function DocSkin({ doc, brand, font, template }) {
  const m = buildDocModel(doc, brand, font, template)
  if (m.tpl === 'simple') return <SkinSimple m={m} />
  if (m.tpl === 'flexible') return <SkinFlexible m={m} />
  return <SkinModern m={m} />
}
