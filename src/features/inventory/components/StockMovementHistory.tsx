import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { SearchBar } from '@/components/shared/SearchBar'
import { Spinner } from '@/components/ui/States'
import { formatNumber, formatDateTime } from '@/lib/utils'

// Read-only view of inventory_ledger entries filtered to specific movement
// types — the shared backbone of the Adjustment and Transfer tabs.
export function StockMovementHistory({ movementTypes, emptyTitle }: { movementTypes: string[]; emptyTitle: string }) {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    supabase.from('inventory_ledger').select('*, products(name,material_code), warehouses(code)')
      .eq('client_id', clientId).in('movement_type', movementTypes)
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data, error }) => {
        if (error) notify('error', `Could not load movements: ${error.message}`)
        setRows(data ?? []); setLoading(false)
      })
  }, [clientId, movementTypes.join(',')])

  const filtered = useMemo(() => {
    if (!q.trim()) return rows
    const t = q.toLowerCase()
    return rows.filter(r => [r.products?.name, r.products?.material_code, r.reference_no, r.remarks].some(v => String(v ?? '').toLowerCase().includes(t)))
  }, [rows, q])

  const columns = [
    { key: 'date', header: 'Date', render: (r: any) => formatDateTime(r.created_at), sortable: true, accessor: (r: any) => r.created_at },
    { key: 'type', header: 'Movement', render: (r: any) => <Badge tone="info">{r.movement_type}</Badge> },
    { key: 'code', header: 'Material', accessor: (r: any) => r.products?.material_code, className: 'font-medium' },
    { key: 'name', header: 'Product', accessor: (r: any) => r.products?.name },
    { key: 'wh', header: 'WH', accessor: (r: any) => r.warehouses?.code },
    { key: 'in', header: 'In', render: (r: any) => r.qty_in > 0 ? <span className="text-green-600">+{formatNumber(r.qty_in)}</span> : '—', className: 'text-right' },
    { key: 'out', header: 'Out', render: (r: any) => r.qty_out > 0 ? <span className="text-orange-600">−{formatNumber(r.qty_out)}</span> : '—', className: 'text-right' },
    { key: 'bal', header: 'Balance', accessor: (r: any) => r.balance_after, className: 'text-right font-medium' },
    { key: 'ref', header: 'Reference', accessor: (r: any) => r.reference_no ?? '—' }
  ]

  if (loading) return <Spinner label="Loading movements…" />
  return (
    <div className="space-y-4">
      <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search movements…" /></div>
      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={filtered} rowKey={(r: any) => String(r.id)} emptyTitle={emptyTitle} />
      </Card>
    </div>
  )
}
