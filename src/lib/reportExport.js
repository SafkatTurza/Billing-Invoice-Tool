// Uniform Excel export for finance reports (Phase G). One place that turns a
// report — described as a set of sheets, each a stack of titled sections — into
// an .xlsx workbook. Reports (trial balance, account statement, GL by head,
// trends, forecast) all funnel through here so their exports look the same.
// The xlsx library is imported dynamically so it stays out of the initial bundle.

// sheets: [{ name, sections: [{ title?, columns?, rows: any[][] }] }]
export async function exportReport(filename, sheets) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const aoa = []
    let maxCols = 1
    for (const section of sheet.sections || []) {
      if (section.title) aoa.push([section.title])
      if (section.columns) aoa.push(section.columns)
      for (const row of section.rows || []) {
        aoa.push(row)
        maxCols = Math.max(maxCols, row.length)
      }
      if (section.columns) maxCols = Math.max(maxCols, section.columns.length)
      aoa.push([]) // blank spacer between sections
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // First column wide (labels), the rest a comfortable numeric width.
    ws['!cols'] = Array.from({ length: maxCols }, (_, i) => ({ wch: i === 0 ? 34 : 16 }))
    // Excel caps sheet names at 31 chars and forbids a few symbols.
    const safe = (sheet.name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, safe)
  }

  XLSX.writeFile(wb, filename)
}
