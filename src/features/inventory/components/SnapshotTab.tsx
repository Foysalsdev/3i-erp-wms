import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

type SnapJoined = Tables<'inventory_snapshots'> & {
  products: Pick<Tables<'products'>, 'name' | 'material_code'> | null
  warehouses: Pick<Tables<'warehouses'>, 'code'> | null
}
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { formatNumber, formatDate } from '@/lib/utils'

// Captures a point-in-time snapshot of current on-hand stock.
export function SnapshotTab() {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<SnapJoined[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = () => {
    if (!clientId) return
    setLoading(true)
    supabase.from('inventory_snapshots').select('*, products(name,material_code), warehouses(code)')
      .order('snapshot_date', { ascending: false }).limit(500)
      .then(({ data, error }) => {
        if (error) notify('error', `Could not load snapshots: ${error.message}`)
        setRows(data ?? []); setLoading(false)
      })
  }
  useEffect(load, [clientId])

  const capture = async () => {
    setBusy(true)
    const { data: stock, error: readErr } = await supabase.from('inventory_stock').select('product_id,warehouse_id,stock_status,quantity')
    if (readErr) { notify('error', `Could not read stock: ${readErr.message}`); setBusy(false); return }
    if (stock?.length) {
      const { error: insErr } = await supabase.from('inventory_snapshots').insert(stock.map(s => ({
         product_id: s.product_id, warehouse_id: s.warehouse_id, stock_status: s.stock_status, quantity: s.quantity
      })))
      if (insErr) { notify('error', `Snapshot failed: ${insErr.message}`); setBusy(false); return }
      notify('success', `Snapshot captured (${stock.length} rows)`)
    } else notify('info', 'No stock to snapshot')
    setBusy(false); load()
  }

  const columns: Column<SnapJoined>[] = [
    { key: 'date', header: 'Snapshot Date', render: r => formatDate(r.snapshot_date), sortable: true, accessor: r => r.snapshot_date },
    { key: 'code', header: 'Material', accessor: r => r.products?.material_code, className: 'font-medium' },
    { key: 'name', header: 'Product', accessor: r => r.products?.name },
    { key: 'wh', header: 'Warehouse', accessor: r => r.warehouses?.code },
    { key: 'status', header: 'Condition', accessor: r => r.stock_status },
    { key: 'qty', header: 'Quantity', render: r => formatNumber(r.quantity), className: 'text-right font-medium' }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex justify-end"><Button icon="photo_camera" loading={busy} onClick={capture}>Capture Snapshot</Button></div>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill loading={loading} columns={columns} rows={rows} rowKey={r => r.id}
          emptyIcon="photo_camera" emptyTitle="No snapshots yet" emptyHint="Capture a point-in-time view of current stock for audit & reconciliation." />
      </Card>
    </div>
  )
}
