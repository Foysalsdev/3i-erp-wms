import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { SearchBar } from '@/components/shared/SearchBar'
import { Spinner } from '@/components/ui/States'
import { formatDate } from '@/lib/utils'

const tone: Record<string, any> = { in_stock: 'positive', reserved: 'info', delivered: 'neutral', returned: 'critical', damaged: 'negative', quarantine: 'critical', scrapped: 'neutral' }

export function SerialsTab() {
  const clientId = useAuth(s => s.currentClientId)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    supabase.from('serial_numbers').select('*, products(name,material_code), warehouses(code)')
      .eq('client_id', clientId).order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => { setRows(data ?? []); setLoading(false) })
  }, [clientId])

  const filtered = useMemo(() => {
    if (!q.trim()) return rows
    const t = q.toLowerCase()
    return rows.filter(r => [r.serial_no, r.products?.name, r.products?.material_code].some(v => String(v ?? '').toLowerCase().includes(t)))
  }, [rows, q])

  const columns = [
    { key: 'serial', header: 'Serial No', accessor: (r: any) => r.serial_no, sortable: true, className: 'font-medium' },
    { key: 'code', header: 'Material', accessor: (r: any) => r.products?.material_code },
    { key: 'name', header: 'Product', accessor: (r: any) => r.products?.name },
    { key: 'wh', header: 'Warehouse', accessor: (r: any) => r.warehouses?.code ?? '—' },
    { key: 'status', header: 'Status', render: (r: any) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
    { key: 'wstart', header: 'Warranty Start', render: (r: any) => formatDate(r.warranty_start) },
    { key: 'wend', header: 'Warranty End', render: (r: any) => formatDate(r.warranty_end) }
  ]

  if (loading) return <Spinner label="Loading serials…" />
  return (
    <div className="space-y-4">
      <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search serial / product…" /></div>
      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={filtered} rowKey={(r: any) => r.id} emptyTitle="No serial numbers tracked yet" />
      </Card>
    </div>
  )
}
