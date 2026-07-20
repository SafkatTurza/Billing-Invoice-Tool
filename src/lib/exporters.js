// Document exporters — Excel (.xlsx) and Word (.docx), generated fully
// client-side. The original required a local python-docx server on :7788;
// generating in-browser instead means export works anywhere, including the
// deployed build. Libraries are dynamically imported so they don't bloat the
// initial bundle.

import { calcTotals, lineAmount } from './pricing.js'
import { amountInWords } from './amountInWords.js'
import { formatMoney, formatDate } from './format.js'
import { metaFor } from './docmeta.js'

function num(v) {
  return Number(v) || 0
}

// ── Excel ────────────────────────────────────────────────────────────────
export async function exportExcel(doc) {
  const XLSX = await import('xlsx')
  const meta = metaFor(doc.type)
  const cur = doc.currency || 'USD'
  const wb = XLSX.utils.book_new()

  if (doc.type === 'money-receipt') {
    const rows = [
      ['Money Receipt', doc.docNumber],
      ['Date', formatDate(doc.date)],
      ['Received From', doc.partyName],
      ['Amount Received', num(doc.receivedAmount)],
      ['Currency', cur],
      ['In Words', amountInWords(num(doc.receivedAmount), cur)],
      ['Payment Method', doc.paymentMethod],
      ['Purpose', doc.paymentPurpose],
      ['Bank', doc.bankName],
      ['Branch', doc.branch],
      ['Cheque No', doc.chequeNo],
      ['Ref No', doc.refNo],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 46 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Receipt')
    XLSX.writeFile(wb, `${doc.docNumber}.xlsx`)
    return
  }

  const t = calcTotals(doc)

  // Sheet 1 — Summary
  const summary = [
    [meta.singular, doc.docNumber],
    ['Date', formatDate(doc.date)],
    [meta.dueLabel || 'Due', doc.dueDate ? formatDate(doc.dueDate) : ''],
    ['Reference', doc.reference],
    ['Status', doc.status],
    [meta.partyLabel, doc.partyName],
    ['Contact', doc.contactPerson],
    ['Currency', cur],
    [],
    ['Subtotal', num(t.subtotal)],
    ...(doc.discountOn ? [[`Discount (${doc.discountRate || 0}%)`, -num(t.discountAmount)]] : []),
    ...(doc.aitOn ? [[`AIT/TAX (${doc.aitRate || 0}%)`, num(t.aitAmount)]] : []),
    ...(doc.aitOn ? [[`VAT (${doc.vatRate || 0}%)`, num(t.vatAmount)]] : []),
    ['Grand Total', num(t.grandTotal)],
    ['In Words', amountInWords(t.grandTotal, cur)],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summary)
  ws1['!cols'] = [{ wch: 24 }, { wch: 42 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

  // Sheet 2 — Line Items
  const itemRows = [['#', 'Item', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']]
  ;(doc.items || []).forEach((it, i) => {
    itemRows.push([i + 1, it.name, it.description, num(it.qty), it.unit, num(it.rate), lineAmount(it)])
  })
  const ws2 = XLSX.utils.aoa_to_sheet(itemRows)
  ws2['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 34 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Line Items')

  // Sheet 3 — Signatures
  const sigRows = [['Label', 'Name', 'Designation', 'Date']]
  ;(doc.signatures || []).forEach((s) => sigRows.push([s.label, s.name, s.designation, s.date]))
  const ws3 = XLSX.utils.aoa_to_sheet(sigRows)
  ws3['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Signatures')

  XLSX.writeFile(wb, `${doc.docNumber}.xlsx`)
}

// ── Word (DOCX) ──────────────────────────────────────────────────────────
export async function exportDocx(doc, brand = '#1E2D5A') {
  const docx = await import('docx')
  const { saveAs } = await import('file-saver')
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    HeadingLevel,
  } = docx

  const meta = metaFor(doc.type)
  const cur = doc.currency || 'USD'
  const hex = brand.replace('#', '')

  const P = (text, opts = {}) =>
    new Paragraph({ children: [new TextRun({ text: text ?? '', ...opts.run })], ...opts.p })

  const bold = (text, size = 22) => new TextRun({ text, bold: true, size })

  const cell = (text, opts = {}) =>
    new TableCell({
      width: opts.width,
      shading: opts.shading ? { fill: opts.shading } : undefined,
      children: [
        new Paragraph({
          alignment: opts.align,
          children: [new TextRun({ text: String(text ?? ''), bold: opts.bold, color: opts.color, size: opts.size || 20 })],
        }),
      ],
    })

  const children = []

  // Header
  children.push(
    new Paragraph({
      children: [new TextRun({ text: (doc.footer?.name || 'Company').toUpperCase(), bold: true, size: 30, color: hex })],
    }),
  )
  children.push(new Paragraph({ children: [new TextRun({ text: `${meta.singular} — ${doc.docNumber}`, size: 24, bold: true })] }))
  children.push(new Paragraph({ children: [new TextRun({ text: `Date: ${formatDate(doc.date)}   Status: ${doc.status}`, size: 20, color: '666666' })] }))
  children.push(new Paragraph({ text: '' }))

  // Party
  children.push(new Paragraph({ children: [bold(meta.partyLabel, 20)] }))
  children.push(new Paragraph({ children: [new TextRun({ text: doc.partyName || '', size: 22, bold: true })] }))
  ;[doc.contactPerson, doc.partyAddress, doc.partyPhone, doc.partyEmail].filter(Boolean).forEach((line) => {
    children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20, color: '444444' })] }))
  })
  children.push(new Paragraph({ text: '' }))

  if (doc.type === 'money-receipt') {
    children.push(new Paragraph({ children: [bold('Amount Received: ', 22), new TextRun({ text: formatMoney(doc.receivedAmount, cur), size: 22 })] }))
    children.push(new Paragraph({ children: [new TextRun({ text: amountInWords(num(doc.receivedAmount), cur), italics: true, size: 20 })] }))
    if (doc.paymentPurpose) children.push(new Paragraph({ children: [new TextRun({ text: 'Purpose: ' + doc.paymentPurpose, size: 20 })] }))
  } else {
    const t = calcTotals(doc)
    // Items table
    const headRow = new TableRow({
      children: [
        cell('#', { shading: hex, color: 'FFFFFF', bold: true }),
        cell('Item', { shading: hex, color: 'FFFFFF', bold: true }),
        cell('Qty', { shading: hex, color: 'FFFFFF', bold: true, align: AlignmentType.RIGHT }),
        cell('Rate', { shading: hex, color: 'FFFFFF', bold: true, align: AlignmentType.RIGHT }),
        cell('Amount', { shading: hex, color: 'FFFFFF', bold: true, align: AlignmentType.RIGHT }),
      ],
    })
    const itemRows = (doc.items || []).map(
      (it, i) =>
        new TableRow({
          children: [
            cell(i + 1),
            cell(it.name + (it.description ? '\n' + it.description : '')),
            cell(it.qty || '', { align: AlignmentType.RIGHT }),
            cell(Number(it.rate) > 0 ? formatMoney(it.rate, cur) : '—', { align: AlignmentType.RIGHT }),
            cell(formatMoney(lineAmount(it), cur), { align: AlignmentType.RIGHT, bold: true }),
          ],
        }),
    )
    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headRow, ...itemRows] }),
    )
    children.push(new Paragraph({ text: '' }))

    const totalLine = (label, val, boldIt) =>
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `${label}: ${val}`, bold: boldIt, size: boldIt ? 24 : 20, color: boldIt ? hex : '333333' })],
      })
    children.push(totalLine('Subtotal', formatMoney(t.subtotal, cur)))
    if (doc.discountOn) children.push(totalLine(`Discount (${doc.discountRate || 0}%)`, '- ' + formatMoney(t.discountAmount, cur)))
    if (doc.aitOn) {
      children.push(totalLine(`AIT/TAX (${doc.aitRate || 0}%)`, formatMoney(t.aitAmount, cur)))
      children.push(totalLine(`VAT (${doc.vatRate || 0}%)`, formatMoney(t.vatAmount, cur)))
    }
    children.push(totalLine('Grand Total', formatMoney(t.grandTotal, cur), true))
    children.push(new Paragraph({ children: [new TextRun({ text: 'In words: ' + amountInWords(t.grandTotal, cur), italics: true, size: 20 })] }))
  }

  if (doc.notes) {
    children.push(new Paragraph({ text: '' }))
    children.push(new Paragraph({ children: [bold('Notes / Terms', 20)] }))
    children.push(new Paragraph({ children: [new TextRun({ text: doc.notes, size: 20, color: '444444' })] }))
  }

  const document = new Document({
    sections: [{ properties: {}, children }],
  })
  const blob = await Packer.toBlob(document)
  saveAs(blob, `${doc.docNumber}.docx`)
}
