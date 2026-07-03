import ExcelJS from 'exceljs'

// One row per SKU with the month's aggregates and per-day matrices.
export interface DailyRow {
  code: string; name: string; category: string
  opening: number; inbound: number; outbound: number
  replIn: number; replOut: number; otherNet: number; closing: number
  inByDay: number[]; outByDay: number[]; replByDay: number[]
}

const HEAD_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEB111' } }
const SUB_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F0DC' } }
const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }
}

// Group rows by category preserving first-seen order.
const groups = (rows: DailyRow[]) => {
  const map = new Map<string, DailyRow[]>()
  rows.forEach(r => {
    const k = r.category || 'Uncategorized'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  })
  return map
}

function matrixSheet(wb: ExcelJS.Workbook, title: string, monthLabel: string, days: number,
  rows: DailyRow[], pick: (r: DailyRow) => number[]) {
  const ws = wb.addWorksheet(title)
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 2 }]
  ws.getColumn(1).width = 10
  ws.getColumn(2).width = 42
  for (let d = 1; d <= days; d++) ws.getColumn(2 + d).width = 6.5
  ws.getColumn(3 + days).width = 9

  const t = ws.addRow([`${title} — ${monthLabel}`])
  t.font = { bold: true, size: 13 }
  ws.mergeCells(1, 1, 1, Math.min(3 + days, 12))

  const head = ws.addRow(['Code', 'SKU Description', ...Array.from({ length: days }, (_, i) => i + 1), 'Total'])
  head.eachCell(c => { c.fill = HEAD_FILL; c.font = { bold: true }; c.border = thin; c.alignment = { horizontal: 'center' } })

  for (const [cat, list] of groups(rows)) {
    const sub = Array.from({ length: days }, () => 0)
    list.forEach(r => {
      const byDay = pick(r)
      byDay.forEach((v, i) => { sub[i] += v })
      const total = byDay.reduce((s, v) => s + v, 0)
      const row = ws.addRow([r.code, r.name, ...byDay.map(v => v || null), total || null])
      row.eachCell({ includeEmpty: false }, c => { c.border = thin })
    })
    const subTotal = sub.reduce((s, v) => s + v, 0)
    const sr = ws.addRow(['', `Total ${cat} (Pcs)`, ...sub.map(v => v || null), subTotal || null])
    sr.eachCell({ includeEmpty: false }, c => { c.fill = SUB_FILL; c.font = { bold: true }; c.border = thin })
  }
}

// Builds the same workbook shape the team used to maintain by hand:
//  • Summary — per SKU: opening, inbound, outbound, replacement, closing
//  • Daily Inbound / Daily Outbound / Daily Replacement — SKU × day matrices
// so the generated file can be shared exactly like the old manual report.
export async function downloadDailyInOutExcel({ clientName, ym, days, rows }:
  { clientName: string; ym: string; days: number; rows: DailyRow[] }) {
  const monthLabel = new Date(`${ym}-01T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  const wb = new ExcelJS.Workbook()
  wb.creator = '3i ERP/WMS'
  wb.created = new Date()

  const ws = wb.addWorksheet('Summary')
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 2 }]
  const widths = [10, 42, 12, 12, 12, 11, 11, 11, 12]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const t = ws.addRow([`Daily Inbound & Outbound Summary — ${clientName} — ${monthLabel}`])
  t.font = { bold: true, size: 13 }
  ws.mergeCells(1, 1, 1, 9)

  const head = ws.addRow(['Code', 'SKU Description', 'Opening', 'Total Inbound', 'Total Outbound', 'Repl. In', 'Repl. Out', 'Adjust/Other', 'Closing'])
  head.eachCell(c => { c.fill = HEAD_FILL; c.font = { bold: true }; c.border = thin; c.alignment = { horizontal: 'center' } })

  for (const [cat, list] of groups(rows)) {
    let s = { opening: 0, inbound: 0, outbound: 0, replIn: 0, replOut: 0, otherNet: 0, closing: 0 }
    list.forEach(r => {
      s = {
        opening: s.opening + r.opening, inbound: s.inbound + r.inbound, outbound: s.outbound + r.outbound,
        replIn: s.replIn + r.replIn, replOut: s.replOut + r.replOut, otherNet: s.otherNet + r.otherNet, closing: s.closing + r.closing
      }
      const row = ws.addRow([r.code, r.name, r.opening, r.inbound || null, r.outbound || null, r.replIn || null, r.replOut || null, r.otherNet || null, r.closing])
      row.eachCell({ includeEmpty: false }, c => { c.border = thin })
    })
    const sr = ws.addRow(['', `Total ${cat} (Pcs)`, s.opening, s.inbound || null, s.outbound || null, s.replIn || null, s.replOut || null, s.otherNet || null, s.closing])
    sr.eachCell({ includeEmpty: false }, c => { c.fill = SUB_FILL; c.font = { bold: true }; c.border = thin })
  }

  matrixSheet(wb, 'Daily Inbound Report', monthLabel, days, rows, r => r.inByDay)
  matrixSheet(wb, 'Daily Outbound Report', monthLabel, days, rows, r => r.outByDay)
  matrixSheet(wb, 'Daily Replacement Report', monthLabel, days, rows, r => r.replByDay)

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Daily_Inbound_Outbound_Report_${ym}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
