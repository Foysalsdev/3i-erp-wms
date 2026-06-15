import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { Spinner, EmptyState } from '@/components/ui/States'
import { formatNumber, formatDate } from '@/lib/utils'

// Captures a point-in-time snapshot of current on-hand stock.
export function SnapshotTab() {
  const clientId = useAuth(s => s.currentClientId)
  const isAdmin = useAuth(s => s.isPlatformAdmin)
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<any>(null)

  const load = () => {
    if (!clientId) return
    setLoading(true)
    supabase.from('inventory_snapshots').select('*, products(name,material_code), warehouses(code)')
      .eq('client_id', clientId).order('snapshot_date', { ascending: false }).limit(500)
      .then(({ data }) => { setRows(data ?? []); setLoading(false) })
  }
  useEffect(load, [clientId])

  const capture = async () => {
    setBusy(true)
    const { data: stock } = await supabase.from('inventory_stock').select('product_id,warehouse_id,stock_status,quantity').eq('client_id', clientId!)
    if (stock?.length) {
      await supabase.from('inventory_snapshots').insert(stock.map(s => ({
        client_id: clientId!, product_id: s.product_id, warehouse_id: s.warehouse_id, stock_status: s.stock_status, quantity: s.quantity
      })))
      notify('success', `Snapshot captured (${stock.length} rows)`)
    } else notify('info', 'No stock to snapshot')
    setBusy(false); load()
  }

  const columns = [
    { key: 'date', header: 'Snapshot Date', render: (r: any) => formatDate(r.snapshot_date), sortable: true, accessor: (r: any) => r.snapshot_date },
    { key: 'code', header: 'Material', accessor: (r: any) => r.products?.material_code, className: 'font-medium' },
    { key: 'name', header: 'Product', accessor: (r: any) => r.products?.name },
    { key: 'wh', header: 'Warehouse', accessor: (r: any) => r.warehouses?.code },
    { key: 'status', header: 'Condition', accessor: (r: any) => r.stock_status },
    { key: 'qty', header: 'Quantity', render: (r: any) => formatNumber(r.quantity), className: 'text-right font-medium' }
  ]

  // Delete is restricted to platform admins and requires password confirmation.
  const actionCol = {
    key: '__actions', header: '', className: 'w-px whitespace-nowrap',
    render: (r: any) => (
      <div className="flex justify-end" onClick={e => e.stopPropagation()}>
        <ActionMenu items={[{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }]} />
      </div>
    )
  }
  const allColumns = isAdmin ? [...columns, actionCol] : columns

  if (loading) return <Spinner label="Loading snapshots…" />
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon="photo_camera" loading={busy} onClick={capture}>Capture Snapshot</Button></div>
      <Card className="overflow-hidden">
        {rows.length ? <DataTable columns={allColumns} rows={rows} rowKey={(r: any) => r.id} /> :
          <EmptyState icon="photo_camera" title="No snapshots yet" hint="Capture a point-in-time view of current stock for audit & reconciliation." />}
      </Card>
      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `snapshot · ${deleting.products?.name ?? formatDate(deleting.snapshot_date)}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('inventory_snapshots').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); load() }
          return res
        }} />
    </div>
  )
}
