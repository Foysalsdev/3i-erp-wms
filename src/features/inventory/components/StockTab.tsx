import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SearchBar } from '@/components/shared/SearchBar'
import { Spinner } from '@/components/ui/States'
import { formatNumber } from '@/lib/utils'
import { STOCK_STATUS } from '@/lib/constants'
import { StockAdjustModal } from './StockAdjustModal'
import { downloadStockPDF, type StockRow } from '@/pdf/StockReportPDF'

export function StockTab({ statusFilter, title }: { statusFilter?: 'good' | 'damaged' | 'quarantine'; title: string }) {
  const { currentClientId, clients, can } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [adjust, setAdjust] = useState(false)
  const client = clients.find(c => c.id === currentClientId)

  const load = () => {
    if (!currentClientId) return
    setLoading(true)
    let query = supabase.from('inventory_stock')
      .select('*, products(name,material_code,restock_level), warehouses(name,code), locations(location_code)')
      .eq('client_id', currentClientId)
    if (statusFilter) query = query.eq('stock_status', statusFilter)
    query.then(({ data }) => { setRows(data ?? []); setLoading(false) })
  }
  useEffect(load, [currentClientId, statusFilter])

  const filtered = useMemo(() => {
    if (!q.trim()) return rows
    const t = q.toLowerCase()
    return rows.filter(r => (r.products?.name ?? '').toLowerCase().includes(t) || (r.products?.material_code ?? '').toLowerCase().includes(t))
  }, [rows, q])

  const columns = [
    { key: 'code', header: 'Material Code', accessor: (r: any) => r.products?.material_code, sortable: true, className: 'font-medium' },
    { key: 'name', header: 'Product', accessor: (r: any) => r.products?.name, sortable: true },
    { key: 'wh', header: 'Warehouse', accessor: (r: any) => r.warehouses?.code },
    { key: 'loc', header: 'Location', accessor: (r: any) => r.locations?.location_code ?? '—' },
    { key: 'status', header: 'Condition', render: (r: any) => <Badge tone={STOCK_STATUS[r.stock_status as keyof typeof STOCK_STATUS]?.tone}>{r.stock_status}</Badge> },
    { key: 'qty', header: 'On Hand', accessor: (r: any) => r.quantity, sortable: true, className: 'text-right font-medium',
      render: (r: any) => <span className={Number(r.quantity) <= Number(r.products?.restock_level ?? 0) ? 'text-horizon-critical font-semibold' : ''}>{formatNumber(r.quantity)}</span> },
    { key: 'reserved', header: 'Reserved', accessor: (r: any) => r.reserved_qty, className: 'text-right' }
  ]

  const exportPDF = () => {
    const data: StockRow[] = filtered.map(r => ({
      code: r.products?.material_code ?? '', name: r.products?.name ?? '', warehouse: r.warehouses?.code ?? '',
      status: r.stock_status, qty: Number(r.quantity)
    }))
    downloadStockPDF(client?.name ?? '', data, title)
  }

  if (loading) return <Spinner label="Loading stock…" />
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search product…" /></div>
        <span className="text-sm text-horizon-muted">{filtered.length} records</span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon="picture_as_pdf" onClick={exportPDF}>PDF</Button>
          {can('inventory.adjust') && <Button icon="add" onClick={() => setAdjust(true)}>Post Movement</Button>}
        </div>
      </div>
      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={filtered} rowKey={(r: any) => r.id} emptyTitle="No stock records" />
      </Card>
      <StockAdjustModal open={adjust} onClose={() => setAdjust(false)} onDone={() => { setAdjust(false); load() }} />
    </div>
  )
}
