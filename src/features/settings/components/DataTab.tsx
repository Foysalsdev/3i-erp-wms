import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { SearchBar } from '@/components/shared/SearchBar'
import { downloadCSV } from '@/lib/csv'
import { downloadBlob } from '@/lib/utils'
import { MASTERS, MASTER_ORDER } from '@/features/masters/registry'
import { OPERATIONS } from '@/features/operations/registry'

// Data Management: export any register to CSV, or every master in one Excel
// workbook — the monthly SAP-reconciliation / offline-backup path. The table
// catalog is assembled dynamically from the masters + operations registries
// and the core transaction tables, so a new registry entry appears here
// automatically.
interface Exportable { table: string; title: string; group: string; icon: string }

const CORE_TABLES: Exportable[] = [
  { table: 'sales_orders', title: 'Sales Orders', group: 'Transactions', icon: 'shopping_cart' },
  { table: 'delivery_challans', title: 'Delivery Challans', group: 'Transactions', icon: 'receipt' },
  { table: 'goods_receipts', title: 'Goods Receipts (GRN)', group: 'Transactions', icon: 'inventory' },
  { table: 'purchase_requisitions', title: 'Inward Requisitions', group: 'Transactions', icon: 'assignment' },
  { table: 'stock_counts', title: 'Stock Counts', group: 'Transactions', icon: 'fact_check' },
  { table: 'inventory_stock', title: 'Inventory Stock (on hand)', group: 'Inventory', icon: 'stacks' },
  { table: 'inventory_ledger', title: 'Inventory Ledger (movements)', group: 'Inventory', icon: 'receipt_long' },
  { table: 'serial_numbers', title: 'Serial Numbers', group: 'Inventory', icon: 'qr_code_2' }
]

function catalog(): Exportable[] {
  const seen = new Set<string>()
  const out: Exportable[] = []
  const push = (e: Exportable) => { if (!seen.has(e.table)) { seen.add(e.table); out.push(e) } }
  MASTER_ORDER.forEach(k => { const d = MASTERS[k]; if (d) push({ table: d.table, title: d.title, group: 'Masters', icon: d.icon }) })
  CORE_TABLES.forEach(push)
  Object.values(OPERATIONS).forEach(d => push({ table: d.table, title: d.title, group: 'Operations', icon: d.icon }))
  return out
}

// Page through a table (PostgREST caps a response at 1000 rows).
async function fetchAll(table: string, clientId: string): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table as any).select('*')
      .eq('client_id', clientId).order('created_at', { ascending: true }).range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

const csvCols = (rows: any[]) => Object.keys(rows[0] ?? {}).map(k => ({ key: k, header: k }))

export function DataTab() {
  const { currentClientId, clients } = useAuth()
  const notify = useUI(s => s.notify)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const clientName = clients.find(c => c.id === currentClientId)?.name ?? 'client'

  const items = useMemo(catalog, [])
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? items.filter(i => i.title.toLowerCase().includes(t) || i.table.includes(t)) : items
  }, [items, q])
  const groups = useMemo(() => {
    const m = new Map<string, Exportable[]>()
    filtered.forEach(i => {
      if (!m.has(i.group)) m.set(i.group, [])
      m.get(i.group)!.push(i)
    })
    return [...m.entries()]
  }, [filtered])

  const exportOne = async (item: Exportable) => {
    if (!currentClientId) return
    setBusy(item.table)
    try {
      const rows = await fetchAll(item.table, currentClientId)
      if (!rows.length) { notify('info', `${item.title}: no rows to export`); return }
      downloadCSV(item.title, csvCols(rows), rows)
      notify('success', `${item.title}: ${rows.length} row(s) exported`)
    } catch (e: any) {
      notify('error', `${item.title}: ${e?.message ?? 'export failed'}`)
    } finally { setBusy(null) }
  }

  // Every master in one workbook, one sheet per master.
  const exportWorkbook = async () => {
    if (!currentClientId) return
    setBusy('__workbook')
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      let total = 0
      for (const k of MASTER_ORDER) {
        const d = MASTERS[k]
        if (!d) continue
        const rows = await fetchAll(d.table, currentClientId)
        const ws = wb.addWorksheet(d.singular.slice(0, 31))
        if (!rows.length) { ws.addRow(['(empty)']); continue }
        const keys = Object.keys(rows[0])
        const head = ws.addRow(keys)
        head.font = { bold: true }
        rows.forEach(r => ws.addRow(keys.map(key => {
          const v = r[key]
          return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
        })))
        ws.columns.forEach(c => { c.width = 18 })
        total += rows.length
      }
      const buf = await wb.xlsx.writeBuffer()
      downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `Masters_${clientName.replace(/[^\w]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`)
      notify('success', `Master data workbook exported (${total} rows across ${MASTER_ORDER.length} sheets)`)
    } catch (e: any) {
      notify('error', e?.message ?? 'Workbook export failed')
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-700"><Icon name="table_view" className="text-[22px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">All masters — one Excel workbook</p>
          <p className="text-xs text-ink-soft">One sheet per master ({MASTER_ORDER.length} sheets), every column, ready for SAP reconciliation or offline backup.</p>
        </div>
        <Button icon="download" loading={busy === '__workbook'} onClick={exportWorkbook}>Export Workbook</Button>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <p className="text-sm text-ink-soft">Export any register as CSV — every column, all rows for the active client. Opens directly in Excel.</p>
          <div className="ml-auto w-full sm:w-64"><SearchBar value={q} onChange={setQ} placeholder="Search register…" /></div>
        </div>
        {groups.map(([group, list]) => (
          <div key={group} className="mb-4 last:mb-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{group}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map(item => (
                <button key={item.table} type="button" disabled={busy !== null} onClick={() => exportOne(item)}
                  className="flex items-center gap-3 rounded-xl border border-surface-line px-3.5 py-2.5 text-left transition hover:border-brand-200 hover:shadow-card disabled:opacity-50">
                  <Icon name={busy === item.table ? 'progress_activity' : item.icon}
                    className={'text-[20px] ' + (busy === item.table ? 'animate-spin text-brand-500' : 'text-ink-soft')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                    <span className="block truncate font-mono text-[11px] text-ink-faint">{item.table}</span>
                  </span>
                  <Icon name="download" className="shrink-0 text-[16px] text-ink-faint" />
                </button>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-ink-faint">No matches</p>}
      </Card>
    </div>
  )
}
