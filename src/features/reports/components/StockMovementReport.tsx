import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Spinner } from '@/components/ui/States'
import { SearchBar } from '@/components/shared/SearchBar'
import { formatNumber, formatDateTime } from '@/lib/utils'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '../export'

const n = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

// Inventory ledger — every in/out movement with reference and running balance.
export function StockMovementReport() {
  const { currentClientId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [ledger, setLedger] = useState<any[]>([])
  const [products, setProducts] = useState<Record<string, any>>({})
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    Promise.all([
      supabase.from('inventory_ledger').select('*').eq('client_id', currentClientId).order('created_at', { ascending: false }).limit(1000),
      supabase.from('products').select('id,material_code,name').eq('client_id', currentClientId)
    ]).then(([l, p]) => {
      setLedger(l.data ?? [])
      const pm: Record<string, any> = {}; (p.data ?? []).forEach((r: any) => { pm[r.id] = r })
      setProducts(pm); setLoading(false)
    })
  }, [currentClientId])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return ledger.map((r: any) => {
      const p = products[r.product_id] || {}
      return {
        id: r.id, date: formatDateTime(r.created_at), product: p.material_code ? `${p.material_code} — ${p.name}` : (r.product_id ?? '—'),
        type: r.movement_type ?? '—', ref: [r.reference_type, r.reference_no].filter(Boolean).join(' '),
        qty_in: n(r.qty_in) || '', qty_out: n(r.qty_out) || '', balance: n(r.balance_after), status: r.stock_status ?? ''
      }
    }).filter((r: any) => !t || r.product.toLowerCase().includes(t) || String(r.ref).toLowerCase().includes(t) || r.type.toLowerCase().includes(t))
  }, [ledger, products, q])

  const cols: RepCol[] = [
    { key: 'date', header: 'Date/Time', width: '15%' },
    { key: 'product', header: 'Product', width: '28%' },
    { key: 'type', header: 'Movement', width: '12%' },
    { key: 'ref', header: 'Reference', width: '17%' },
    { key: 'qty_in', header: 'In', align: 'right', width: '8%' },
    { key: 'qty_out', header: 'Out', align: 'right', width: '8%' },
    { key: 'balance', header: 'Balance', align: 'right', width: '8%' },
    { key: 'status', header: 'Condition', width: '10%' }
  ]
  const tableCols = cols.map(c => ({
    key: c.key, header: c.header, className: c.align === 'right' ? 'text-right' : '',
    accessor: (r: any) => ['qty_in', 'qty_out', 'balance'].includes(c.key) ? (r[c.key] === '' ? '' : formatNumber(r[c.key])) : r[c.key]
  }))

  if (loading) return <Spinner label="Loading…" />
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportToolbar count={rows.length} onCSV={() => downloadCSV('Stock Movement', cols, rows)} onPDF={() => downloadReportPDF('Stock Movement (Ledger)', 'Every inventory in/out movement', cols, rows)}>
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search product / reference / type…" /></div>
      </ReportToolbar>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={tableCols} rows={rows} rowKey={(r: any) => r.id} emptyTitle="No stock movements yet" />
      </Card>
    </div>
  )
}
