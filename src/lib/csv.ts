import { downloadBlob } from './utils'

export interface CsvCol { key: string; header: string }

// Plain CSV download — opens directly in Excel. Shared by report exports and
// bulk-selection exports (Masters, Operations lists) so both go through one path.
type CsvRow = Record<string, string | number | boolean | null | undefined>

export function downloadCSV(filename: string, cols: CsvCol[], rows: CsvRow[]) {
  const esc = (v: string | number | boolean | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = cols.map(c => esc(c.header)).join(',')
  const body = rows.map(r => cols.map(c => esc(r[c.key])).join(',')).join('\n')
  const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename.replace(/[^\w]+/g, '_')}.csv`)
}
