import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { Spinner } from '@/components/ui/States'
import { formatNumber, formatDateTime } from '@/lib/utils'

export function LedgerTab() {
  const clientId = useAuth(s => s.currentClientId)
  const isAdmin = useAuth(s => s.isPlatformAdmin)
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [deleting, setDeleting] = useState<any>(null)

  const load = () => {
    if (!clientId) return
    setLoading(true)
    supabase.from('inventory_ledger').select('*, products(name,material_code), warehouses(code)')
      .eq('client_id', clientId).order('created_at', { ascending: false }).limit(500)
      .then(({ data, error }) => {
        if (error) notify('error', `Could not load ledger: ${error.message}`)
        setRows(data ?? []); setLoading(false)
      })
  }
  useEffect(load, [clientId])

  const filtered = useMemo(() => {
    if (!q.trim()) return rows
    const t = q.toLowerCase()
    return rows.filter(r => [r.products?.name, r.products?.material_code, r.movement_type, r.reference_no].some(v => String(v ?? '').toLowerCase().includes(t)))
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

  if (loading) return <Spinner label="Loading ledger…" />
  return (
    <div className="space-y-4">
      <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search movements…" /></div>
      <Card className="overflow-hidden">
        <DataTable columns={allColumns} rows={filtered} rowKey={(r: any) => String(r.id)} emptyTitle="No movements recorded" />
      </Card>
      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `ledger entry · ${deleting.movement_type}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('inventory_ledger').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); load() }
          return res
        }} />
    </div>
  )
}
