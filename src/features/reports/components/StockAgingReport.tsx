import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/States'
import { SearchBar } from '@/components/shared/SearchBar'
import { SelectBox } from '@/components/ui/SelectBox'
import { formatNumber, formatDate } from '@/lib/utils'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '../export'

const keyOf = (p: string, w: string, l: string | null) => `${p}|${w}|${l ?? ''}`
const daysSince = (iso?: string | null) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null
const bucketOf = (age: number | null) => age === null ? 'Unknown' : age <= 30 ? '0–30' : age <= 60 ? '31–60' : age <= 90 ? '61–90' : '90+'
const bucketTone = (b: string) => b === '90+' ? 'negative' : b === '61–90' ? 'critical' : b === '31–60' ? 'info' : 'neutral'
const BUCKETS = ['0–30', '31–60', '61–90', '90+', 'Unknown']

// Aging of on-hand stock based on the earliest recorded inbound movement.
export function StockAgingReport() {
  const { currentClientId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stock, setStock] = useState<any[]>([])
  const [firstIn, setFirstIn] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')
  const [bucketFilter, setBucketFilter] = useState('all')

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    Promise.all([
      supabase.from('inventory_stock').select('*, products(name,material_code), warehouses(code)').eq('client_id', currentClientId).gt('quantity', 0),
      supabase.from('inventory_ledger').select('product_id,warehouse_id,location_id,created_at').eq('client_id', currentClientId).gt('qty_in', 0).order('created_at', { ascending: true }).limit(5000)
    ]).then(([s, l]) => {
      setStock(s.data ?? [])
      const earliest: Record<string, string> = {}
      ;(l.data ?? []).forEach((m: any) => { const k = keyOf(m.product_id, m.warehouse_id, m.location_id); if (!earliest[k]) earliest[k] = m.created_at })
      setFirstIn(earliest); setLoading(false)
    })
  }, [currentClientId])

  const rows = useMemo(() => stock.map(r => {
    const received = firstIn[keyOf(r.product_id, r.warehouse_id, r.location_id)] ?? null
    const age = daysSince(received)
    return {
      code: r.products?.material_code ?? '', name: r.products?.name ?? '', warehouse: r.warehouses?.code ?? '',
      condition: r.stock_status, qty: Number(r.quantity), received: received ? formatDate(received) : '—',
      age: age ?? '', bucket: bucketOf(age)
    }
  }).sort((a, b) => (Number(b.age) || -1) - (Number(a.age) || -1)), [stock, firstIn])

  const summary = useMemo(() => {
    const m: Record<string, number> = {}
    rows.forEach(r => { m[r.bucket] = (m[r.bucket] ?? 0) + r.qty })
    return BUCKETS.map(b => ({ bucket: b, qty: m[b] ?? 0 })).filter(x => x.qty > 0)
  }, [rows])

  const filteredRows = useMemo(() => {
    const byBucket = bucketFilter === 'all' ? rows : rows.filter(r => r.bucket === bucketFilter)
    if (!q.trim()) return byBucket
    const t = q.toLowerCase()
    return byBucket.filter(r => r.code.toLowerCase().includes(t) || r.name.toLowerCase().includes(t) || r.warehouse.toLowerCase().includes(t))
  }, [rows, q, bucketFilter])

  const cols: RepCol[] = [
    { key: 'code', header: 'Material Code', width: '15%' },
    { key: 'name', header: 'Product', width: '30%' },
    { key: 'warehouse', header: 'WH', width: '8%' },
    { key: 'condition', header: 'Condition', width: '12%' },
    { key: 'qty', header: 'Qty', align: 'right', width: '10%' },
    { key: 'received', header: 'In Since', width: '12%' },
    { key: 'age', header: 'Age (d)', align: 'right', width: '7%' },
    { key: 'bucket', header: 'Bucket', width: '6%' }
  ]
  const tableCols = [
    { key: 'code', header: 'Material Code', accessor: (r: any) => r.code, className: 'font-medium', sortable: true },
    { key: 'name', header: 'Product', accessor: (r: any) => r.name, sortable: true },
    { key: 'warehouse', header: 'WH', accessor: (r: any) => r.warehouse, sortable: true },
    { key: 'condition', header: 'Condition', accessor: (r: any) => r.condition, sortable: true },
    { key: 'qty', header: 'Qty', className: 'text-right', accessor: (r: any) => r.qty, render: (r: any) => formatNumber(r.qty), sortable: true },
    { key: 'received', header: 'In Since', accessor: (r: any) => r.received, sortable: true },
    { key: 'age', header: 'Age (d)', className: 'text-right', accessor: (r: any) => r.age, sortable: true },
    { key: 'bucket', header: 'Bucket', accessor: (r: any) => r.bucket, render: (r: any) => <Badge tone={bucketTone(r.bucket) as any}>{r.bucket}</Badge>, sortable: true }
  ]

  if (loading) return <Spinner label="Computing aging…" />
  return (
    <div className="space-y-4">
      <ReportToolbar count={filteredRows.length}
        onCSV={() => downloadCSV('Stock Aging', cols, rows)}
        onPDF={() => downloadReportPDF('Stock Aging Report', 'On-hand stock by age bucket', cols, rows)}>
        <div className="w-64"><SearchBar value={q} onChange={setQ} placeholder="Search code, product, warehouse…" /></div>
        <SelectBox value={bucketFilter} onChange={e => setBucketFilter(e.target.value)} className="w-auto py-2">
          <option value="all">All age buckets</option>
          {BUCKETS.map(b => <option key={b} value={b}>{b} days</option>)}
        </SelectBox>
      </ReportToolbar>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {summary.map(s => (
          <Card key={s.bucket} className="p-3">
            <p className="text-xs text-ink-faint">{s.bucket} days</p>
            <p className="mt-1 text-xl font-bold text-ink">{formatNumber(s.qty)}</p>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <DataTable columns={tableCols} rows={filteredRows} rowKey={(r: any) => `${r.code}|${r.warehouse}|${r.condition}|${r.age}`} emptyTitle="No stock to age" />
      </Card>
    </div>
  )
}
