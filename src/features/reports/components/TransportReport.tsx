import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Spinner } from '@/components/ui/States'
import { SearchBar } from '@/components/shared/SearchBar'
import { formatDate } from '@/lib/utils'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '../export'

// Combined dispatch/logistics report: vehicle allocations + courier shipments + PODs.
export function TransportReport() {
  const { currentClientId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rowsRaw, setRowsRaw] = useState<any[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    const sb = supabase as any
    Promise.all([
      sb.from('vehicle_allocations').select('allocation_no,so_id,vehicle_id,transport_vendor_id,status,allocation_date').eq('client_id', currentClientId),
      sb.from('courier_shipments').select('shipment_no,so_id,courier_id,tracking_no,status,dispatch_date').eq('client_id', currentClientId),
      sb.from('pod_collections').select('pod_no,so_id,received_by,status,received_date').eq('client_id', currentClientId),
      supabase.from('sales_orders').select('id,so_no').eq('client_id', currentClientId),
      supabase.from('vehicles').select('id,vehicle_number').eq('client_id', currentClientId),
      sb.from('couriers').select('id,name').eq('client_id', currentClientId),
      supabase.from('transport_vendors').select('id,name').eq('client_id', currentClientId)
    ]).then(([va, cs, pod, so, veh, cour, tv]: any[]) => {
      const soM: Record<string, string> = {}; (so.data ?? []).forEach((r: any) => { soM[r.id] = r.so_no })
      const vM: Record<string, string> = {}; (veh.data ?? []).forEach((r: any) => { vM[r.id] = r.vehicle_number })
      const cM: Record<string, string> = {}; (cour.data ?? []).forEach((r: any) => { cM[r.id] = r.name })
      const tM: Record<string, string> = {}; (tv.data ?? []).forEach((r: any) => { tM[r.id] = r.name })
      const out: any[] = []
      ;(va.data ?? []).forEach((r: any) => out.push({ doc_no: r.allocation_no, type: 'Transport', so: soM[r.so_id] ?? '—', carrier: [tM[r.transport_vendor_id], vM[r.vehicle_id]].filter(Boolean).join(' / ') || '—', status: r.status, date: formatDate(r.allocation_date) }))
      ;(cs.data ?? []).forEach((r: any) => out.push({ doc_no: r.shipment_no, type: 'Courier', so: soM[r.so_id] ?? '—', carrier: [cM[r.courier_id], r.tracking_no].filter(Boolean).join(' / ') || '—', status: r.status, date: formatDate(r.dispatch_date) }))
      ;(pod.data ?? []).forEach((r: any) => out.push({ doc_no: r.pod_no, type: 'POD', so: soM[r.so_id] ?? '—', carrier: r.received_by || '—', status: r.status, date: formatDate(r.received_date) }))
      setRowsRaw(out); setLoading(false)
    })
  }, [currentClientId])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rowsRaw.filter((r: any) => !t || r.doc_no.toLowerCase().includes(t) || r.so.toLowerCase().includes(t) || r.carrier.toLowerCase().includes(t) || r.type.toLowerCase().includes(t))
  }, [rowsRaw, q])

  const cols: RepCol[] = [
    { key: 'doc_no', header: 'Document No', width: '18%' },
    { key: 'type', header: 'Type', width: '12%' },
    { key: 'so', header: 'Sales Order', width: '18%' },
    { key: 'carrier', header: 'Carrier / Detail', width: '28%' },
    { key: 'status', header: 'Status', width: '12%' },
    { key: 'date', header: 'Date', width: '12%' }
  ]
  const tableCols = cols.map(c => ({ key: c.key, header: c.header, accessor: (r: any) => r[c.key] }))

  if (loading) return <Spinner label="Loading…" />
  return (
    <div className="space-y-4">
      <ReportToolbar count={rows.length} onCSV={() => downloadCSV('Transport Dispatch', cols, rows)} onPDF={() => downloadReportPDF('Transport & Dispatch', 'Vehicle allocations, courier shipments & PODs', cols, rows)}>
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search doc / SO / carrier…" /></div>
      </ReportToolbar>
      <Card className="overflow-hidden">
        <DataTable columns={tableCols} rows={rows} rowKey={(r: any) => r.type + r.doc_no} emptyTitle="No dispatch records yet" />
      </Card>
    </div>
  )
}
