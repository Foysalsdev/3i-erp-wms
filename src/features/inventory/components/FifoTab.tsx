import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

type FifoStock = Tables<'inventory_stock'> & {
  products: Pick<Tables<'products'>, 'name' | 'material_code'> | null
  warehouses: Pick<Tables<'warehouses'>, 'code'> | null
  locations: Pick<Tables<'locations'>, 'location_code'> | null
  __received?: string | null
  __age?: number | null
}
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { SearchBar } from '@/components/shared/SearchBar'
import { formatNumber, formatDate } from '@/lib/utils'
import { STOCK_STATUS } from '@/lib/constants'

const keyOf = (productId: string, whId: string, locId: string | null) => `${productId}|${whId}|${locId ?? ''}`
const daysSince = (iso?: string) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null

// FIFO advisory: current stock ordered oldest-first by its earliest recorded
// receipt (first inbound ledger movement for that product/warehouse/location),
// so pickers can consume the oldest stock first.
export function FifoTab() {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [stock, setStock] = useState<FifoStock[]>([])
  const [firstIn, setFirstIn] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    Promise.all([
      supabase.from('inventory_stock')
        .select('*, products(name,material_code), warehouses(code), locations(location_code)')
        .gt('quantity', 0),
      supabase.from('inventory_ledger')
        .select('product_id, warehouse_id, location_id, created_at')
        .gt('qty_in', 0).order('created_at', { ascending: true }).limit(5000)
    ]).then(([s, l]) => {
      if (s.error) notify('error', `Could not load stock: ${s.error.message}`)
      setStock(s.data ?? [])
      // earliest inbound date per product/warehouse/location
      const earliest: Record<string, string> = {}
      ;(l.data ?? []).forEach(m => {
        const k = keyOf(m.product_id, m.warehouse_id, m.location_id)
        if (!earliest[k]) earliest[k] = m.created_at  // rows are ascending, first wins
      })
      setFirstIn(earliest)
      setLoading(false)
    })
  }, [clientId])

  const rows = useMemo(() => {
    const withAge = stock.map(r => {
      const received = firstIn[keyOf(r.product_id, r.warehouse_id, r.location_id)] ?? null
      return { ...r, __received: received, __age: daysSince(received) }
    })
    const t = q.trim().toLowerCase()
    const filtered = t ? withAge.filter(r => (r.products?.name ?? '').toLowerCase().includes(t) || (r.products?.material_code ?? '').toLowerCase().includes(t)) : withAge
    // oldest first; unknown receipt dates sink to the bottom
    return filtered.sort((a, b) => {
      if (a.__received && b.__received) return a.__received < b.__received ? -1 : 1
      if (a.__received) return -1
      if (b.__received) return 1
      return 0
    })
  }, [stock, firstIn, q])

  const columns: Column<FifoStock & { __received?: string | null; __age?: number | null }>[] = [
    { key: 'code', header: 'Material Code', accessor: r => r.products?.material_code, className: 'font-medium' },
    { key: 'name', header: 'Product', accessor: r => r.products?.name },
    { key: 'wh', header: 'WH', accessor: r => r.warehouses?.code },
    { key: 'loc', header: 'Location', accessor: r => r.locations?.location_code ?? '—' },
    { key: 'status', header: 'Condition', render: r => <Badge tone={STOCK_STATUS[r.stock_status as keyof typeof STOCK_STATUS]?.tone}>{STOCK_STATUS[r.stock_status as keyof typeof STOCK_STATUS]?.label ?? r.stock_status}</Badge> },
    { key: 'qty', header: 'On Hand', accessor: r => r.quantity, className: 'text-right font-medium', render: r => formatNumber(r.quantity) },
    { key: 'received', header: 'In Stock Since', render: r => r.__received ? formatDate(r.__received) : '—' },
    { key: 'age', header: 'Age (days)', className: 'text-right', render: r => r.__age == null ? '—' : <span className={r.__age > 90 ? 'font-semibold text-horizon-critical' : ''}>{r.__age}</span> }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search product…" /></div>
        <span className="text-sm text-ink-soft">{rows.length} lots · oldest first</span>
      </div>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill loading={loading} columns={columns} rows={rows} rowKey={r => r.id} emptyTitle="No stock to order" />
      </Card>
      <p className="text-xs text-ink-faint">Stock is ordered by its earliest recorded inbound movement. Consume the top rows first to follow FIFO.</p>
    </div>
  )
}
