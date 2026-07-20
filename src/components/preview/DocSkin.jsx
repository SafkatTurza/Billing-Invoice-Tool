// Template skin engine — one data model, three presentations
// (Simple · Modern · Flexible), ported from the original Paynox source.
// Renders the printable body for Invoice / Estimate / PO / WO.

import { calcTotals, lineAmount } from '../../lib/pricing.js'
import { amountInWords } from '../../lib/amountInWords.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { metaFor } from '../../lib/docmeta.js'

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
    [isPO ? 'Total Payable' : 'Grand Total', money(t.grandTotal, cur), '#1e293b', brand, true],
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
    <div style={{ fontSize: 10, fontWeight: 700, color: accent || m.BC, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
      {m.isPO ? 'Notes / Terms' : 'Terms & Conditions'}
    </div>
    <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.doc.notes}</div>
  </div>
)

const BankBlock = ({ m, accent }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: accent || m.BC, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
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
    <div style={{ fontSize: 10, fontWeight: 700, color: accent || m.BC, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
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

const Sigs = ({ m }) => {
  const sigs = m.doc.signatures || []
  if (!sigs.length) return null
  const cols = Math.min(sigs.length, 3)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20, marginTop: 34 }}>
      {sigs.map((s) => (
        <div key={s.id}>
          <div style={{ borderTop: '1.5px solid #333', paddingTop: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: m.BC }}>{s.label}</div>
            {s.name && <div style={{ fontWeight: 600, fontSize: 12, marginTop: 2 }}>{s.name}</div>}
            {s.designation && <div style={{ fontSize: 11, color: '#666' }}>{s.designation}</div>}
            {s.date && <div style={{ fontSize: 11, color: '#666' }}>{formatDate(s.date)}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

const Footer = ({ f, bc }) => (
  <div style={{ borderTop: `2px solid ${bc}`, margin: '0 0 0', padding: '14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {f.logo && <img src={f.logo} style={{ height: 28, objectFit: 'contain' }} alt="" />}
      <div>
        {f.name && <div style={{ fontWeight: 600, fontSize: 11, color: '#1e293b' }}>{f.name}</div>}
        {f.address && <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'pre-wrap' }}>{f.address}</div>}
      </div>
    </div>
    <div style={{ textAlign: 'right', fontSize: 10, color: '#64748b' }}>
      {f.email && <div>{f.email}</div>}
      {f.phone && <div>{f.phone}</div>}
      {f.website && <div>{f.website}</div>}
    </div>
  </div>
)

const SkinBlocks = ({ m, noWords, noNotes, accent }) => {
  const showNotes = m.doc.notes && !noNotes
  return (
    <div>
      {m.grand > 0 && !noWords && <WordsBox m={m} />}
      {(showNotes || m.hasBank) && (
        <div style={{ display: 'grid', gridTemplateColumns: showNotes && m.hasBank ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 14 }}>
          {showNotes && <NotesBlock m={m} accent={accent} />}
          {m.hasBank && <BankBlock m={m} accent={accent} />}
        </div>
      )}
      {m.doc.milestones && m.doc.milestones.some((ms) => ms.description || ms.percentage) && (
        <MilestonesBlock m={m} accent={accent} />
      )}
      <Sigs m={m} />
    </div>
  )
}

const Items = ({ m, headBg, headColor, headBorder, zebra }) => {
  const { doc, cur } = m
  if (!(doc.items && doc.items.length)) return null
  const showSpec = m.isPO && doc.showSpec
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
      <thead>
        <tr style={{ background: headBg, color: headColor, borderBottom: headBorder || 'none' }}>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: 11, width: 26 }}>#</th>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: 11 }}>Services / Items</th>
          {showSpec && <th style={{ padding: '8px', textAlign: 'left', fontSize: 11, width: 90 }}>Spec</th>}
          <th style={{ padding: '8px', textAlign: 'center', fontSize: 11, width: 50 }}>Qty</th>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: 11, width: 50 }}>Unit</th>
          <th style={{ padding: '8px', textAlign: 'right', fontSize: 11, width: 90 }}>Rate</th>
          <th style={{ padding: '8px', textAlign: 'right', fontSize: 11, width: 100 }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {doc.items.map((item, i) => (
          <tr key={item.id} style={{ background: zebra && i % 2 === 0 ? zebra : '#fff', borderBottom: '1px solid #eef1f5' }}>
            <td style={{ padding: '7px 8px', color: '#94a3b8', textAlign: 'center' }}>{i + 1}</td>
            <td style={{ padding: '7px 8px' }}>
              <div style={{ fontWeight: 500 }}>{item.name}</div>
              {item.description && (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, whiteSpace: 'pre-wrap' }}>{item.description}</div>
              )}
            </td>
            {showSpec && <td style={{ padding: '7px 8px', fontSize: 11 }}>{item.spec}</td>}
            <td style={{ padding: '7px 8px', textAlign: 'center' }}>{item.qty}</td>
            <td style={{ padding: '7px 8px' }}>{item.unit}</td>
            <td style={{ padding: '7px 8px', textAlign: 'right' }}>{Number(item.rate) > 0 ? money(item.rate, cur) : '—'}</td>
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

// ── SKIN 1 · SIMPLE ──
function SkinSimple({ m }) {
  const { label, BC, DF, f, partyLabel, partyName, partyLines, metaRows } = m
  return (
    <div style={{ fontFamily: `"${DF}", sans-serif`, fontSize: 12, color: '#1e293b', background: '#fff', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 130, height: 48, background: BC }} />
      <div style={{ position: 'absolute', top: 56, right: 26, width: 42, height: 18, background: ACC }} />
      <div style={{ padding: '36px 38px 26px' }}>
        <div style={{ marginBottom: 28 }}>
          {f.logo && <img src={f.logo} style={{ height: 30, marginBottom: 12, display: 'block' }} alt="" />}
          <div style={{ fontSize: 44, fontWeight: 700, color: BC, letterSpacing: -1, lineHeight: 1 }}>{label}</div>
          {f.name && <div style={{ fontSize: 12, color: '#64748b', marginTop: 7 }}>{f.name}</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{partyLabel}</div>
            {partyName && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{partyName}</div>}
            <PartyLines lines={partyLines} />
          </div>
          <div>
            {metaRows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9', fontSize: 11.5 }}>
                <span style={{ color: '#94a3b8' }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <Items m={m} headBg="#fff" headColor={BC} headBorder={`2px solid ${BC}`} zebra="#f8fafc" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Totals m={m} />
        </div>
        <SkinBlocks m={m} />
        <div style={{ marginTop: 26 }}>
          <Footer f={f} bc={BC} />
        </div>
      </div>
    </div>
  )
}

// ── SKIN 2 · MODERN ──
function SkinModern({ m }) {
  const { label, BC, DF, f, grand, partyLabel, partyName, partyLines, metaRows, headerTotalLabel, cur } = m
  return (
    <div style={{ fontFamily: `"${DF}", sans-serif`, fontSize: 12, color: '#1e293b', background: '#fff' }}>
      <div style={{ background: BC, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {f.logo && <img src={f.logo} style={{ height: 34, objectFit: 'contain' }} alt="" />}
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>{label.toUpperCase()}</div>
        </div>
        <div style={{ textAlign: 'right', color: '#fff' }}>
          <div style={{ fontSize: 10, opacity: 0.8 }}>{headerTotalLabel}</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{money(grand, cur)}</div>
        </div>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: BC, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, borderBottom: `2px solid ${BC}`, paddingBottom: 3 }}>{partyLabel}</div>
            {partyName && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{partyName}</div>}
            <PartyLines lines={partyLines} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: BC, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, borderBottom: `2px solid ${BC}`, paddingBottom: 3 }}>Document Details</div>
            <table style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {metaRows.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: '#64748b', paddingRight: 8, paddingBottom: 2, fontSize: 11 }}>{k}</td>
                    <td style={{ fontWeight: 500, fontSize: 11, paddingBottom: 2 }}>: {v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Items m={m} headBg={BC} headColor="#fff" zebra="#fafafa" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Totals m={m} />
        </div>
        <SkinBlocks m={m} />
        <div style={{ marginTop: 26 }}>
          <Footer f={f} bc={BC} />
        </div>
      </div>
    </div>
  )
}

// ── SKIN 3 · FLEXIBLE ──
function SkinFlexible({ m }) {
  const { doc, label, BC, DF, f, grand, partyLabel, partyName, partyLines, metaRows } = m
  return (
    <div style={{ fontFamily: `"${DF}", sans-serif`, fontSize: 12, color: '#1e293b', background: '#fff' }}>
      <div
        style={{ background: `linear-gradient(105deg, ${BC} 0%, ${BC} 56%, ${ACC} 56%, ${ACC} 100%)`, padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {f.logo && <img src={f.logo} style={{ height: 38, objectFit: 'contain' }} alt="" />}
          <div>
            {f.name && <div style={{ color: '#fff', fontSize: 17, fontWeight: 700, letterSpacing: 0.5 }}>{f.name}</div>}
            {f.website && <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>{f.website}</div>}
          </div>
        </div>
        <div style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: 1 }}>{label.toUpperCase()}</div>
      </div>
      <div style={{ padding: '22px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACC, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{partyLabel}</div>
            {partyName && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{partyName}</div>}
            <PartyLines lines={partyLines} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACC, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Document Details</div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {metaRows.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: '#64748b', paddingRight: 8, paddingBottom: 3, fontSize: 11 }}>{k}</td>
                    <td style={{ fontWeight: 600, fontSize: 11, paddingBottom: 3, textAlign: 'right' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Items m={m} headBg={BC} headColor="#fff" zebra="#f5f7fa" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 24, marginBottom: 14, alignItems: 'start' }}>
          <div>{doc.notes && <NotesBlock m={m} accent={ACC} />}</div>
          <Totals m={m} boxed />
        </div>
        {grand > 0 && <WordsBox m={m} />}
        <SkinBlocks m={m} noWords noNotes accent={ACC} />
        <div style={{ marginTop: 26 }}>
          <Footer f={f} bc={BC} />
        </div>
      </div>
    </div>
  )
}

export default function DocSkin({ doc, brand, font, template }) {
  const m = buildDocModel(doc, brand, font, template)
  if (m.tpl === 'simple') return <SkinSimple m={m} />
  if (m.tpl === 'flexible') return <SkinFlexible m={m} />
  return <SkinModern m={m} />
}
