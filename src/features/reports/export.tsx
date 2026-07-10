import { downloadCSV, type CsvCol } from '@/lib/csv'

export interface RepCol extends CsvCol { align?: 'right' | 'left'; width?: string }

export { downloadCSV }

// Lazy wrapper: the react-pdf implementation (reportPdf.tsx) is only fetched
// when the user clicks PDF, keeping the 1.4 MB pdf chunk off every page that
// merely shows the export toolbar (reports, finance registers, dashboard).
export async function downloadReportPDF(title: string, subtitle: string, cols: RepCol[], rows: any[]) {
  const { downloadReportPDF: impl } = await import('./reportPdf')
  await impl(title, subtitle, cols, rows)
}

// Shared toolbar: record count + CSV/PDF export buttons.
export function ReportToolbar({ count, onCSV, onPDF, children }: { count: number; onCSV: () => void; onPDF: () => void; children?: any }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      <span className="text-sm text-ink-soft">{count} rows</span>
      <div className="ml-auto flex gap-2">
        <button onClick={onCSV} className="inline-flex items-center gap-1 rounded-lg border border-surface-line px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-sunken">Excel (CSV)</button>
        <button onClick={onPDF} className="inline-flex items-center gap-1 rounded-lg border border-surface-line px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-sunken">PDF</button>
      </div>
    </div>
  )
}
