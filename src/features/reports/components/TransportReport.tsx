import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Spinner } from '@/components/ui/States'
import { SearchBar } from '@/components/shared/SearchBar'
import { formatDate, formatNumber } from '@/lib/utils'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '../export'

// Outbound Transport / Dispatch register — mirrors the manual Excel transport
// sheet: one row per despatched challan with date, SAP invoice, party, route
// (load from → offload to), vehicle or courier, and quantity split by product
// category (Refrigerator / Washing Machine / … discovered from the data).
export function TransportReport() {
  const { currentClientId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [challans, setChallans] = useState<any[]>([])
  const [itemsByCh, setItemsByCh] = useState<Record<string, any[]>>({})
  const [maps, setMaps] = useState<{ cust: Record<string, string>; wh: Record<string, string>; veh: Record<string, string>; tv: Record<string, string>; cat: Record<string, string> }>({ cust: {}, wh: {}, veh: {}, tv: {}, cat: {} })
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    Promise.all([
      supabase.from('delivery_challans')
        .select('id,challan_no,challan_date,invoice_no,customer_id,warehouse_id,unloading_point,delivery_method,vehicle_id,transporter_id,transport_vendor,courier_name,courier_tracking_no,total_qty,delivery_cost,status,posted_at')
        .eq('client_id', currentClientId).order('challan_date', { ascending: false }),
      supabase.from('delivery_challan_items').select('challan_id,product_id,qty').eq('client_id', currentClientId),
      supabase.from('customers').select('id,name').eq('client_id', currentClientId),
      supabase.from('warehouses').select('id,code,name').eq('client_id', currentClientId),
      supabase.from('vehicles').select('id,vehicle_number,vehicle_type').eq('client_id', currentClientId),
      supabase.from('transport_vendors').select('id,name').eq('client_id', currentClientId),
      supabase.from('products').select('id,category').eq('client_id', currentClientId)
    ]).then(([ch, items, cust, wh, veh, tv, prods]: any[]) => {
      const by: Record<string, any[]> = {}
      ;(items.data ?? []).forEach((it: any) => { (by[it.challan_id] ??= []).push(it) })
      const m = (rows: any[], f: (r: any) => string) => Object.fromEntries((rows ?? []).map((r: any) => [r.id, f(r)]))
      setChallans(ch.data ?? [])
      setItemsByCh(by)
      setMaps({
        cust: m(cust.data, (r: any) => r.name),
        wh: m(wh.data, (r: any) => `${r.code} — ${r.name}`),
        veh: m(veh.data, (r: any) => [r.vehicle_number, r.vehicle_type].filter(Boolean).join(' · ')),
        tv: m(tv.data, (r: any) => r.name),
        cat: m(prods.data, (r: any) => r.category || 'Other')
      })
      setLoading(false)
    })
  }, [currentClientId])

  // Category columns discovered from the despatched items (stable order).
  const categories = useMemo(() => {
    const set = new Set<string>()
    Object.values(itemsByCh).flat().forEach((it: any) => set.add(maps.cat[it.product_id] || 'Other'))
    return [...set].sort()
  }, [itemsByCh, maps.cat])

  const rows = useMemo(() => {
    const list = challans.map((c: any) => {
      const items = itemsByCh[c.id] ?? []
      const byCat: Record<string, number> = {}
      items.forEach((it: any) => {
        const k = maps.cat[it.product_id] || 'Other'
        byCat[k] = (byCat[k] || 0) + (Number(it.qty) || 0)
      })
      const courier = c.delivery_method === 'courier'
      return {
        date: formatDate(c.challan_date), challan_no: c.challan_no, invoice: c.invoice_no ?? '—',
        party: maps.cust[c.customer_id] ?? '—', from: maps.wh[c.warehouse_id] ?? '—', to: c.unloading_point || '—',
        mode: courier ? 'Courier' : 'Transport',
        carrier: courier
          ? [c.courier_name, c.courier_tracking_no].filter(Boolean).join(' / ') || '—'
          : [maps.tv[c.transporter_id] || c.transport_vendor, maps.veh[c.vehicle_id]].filter(Boolean).join(' / ') || '—',
        ...Object.fromEntries(categories.map(cat => [cat, byCat[cat] || 0])),
        total: Number(c.total_qty) || 0, cost: Number(c.delivery_cost) || 0,
        status: c.posted_at ? 'issued' : (c.status ?? 'draft')
      }
    })
    const t = q.trim().toLowerCase()
    return t ? list.filter((r: any) => [r.challan_no, r.invoice, r.party, r.carrier, r.to].some(v => String(v).toLowerCase().includes(t))) : list
  }, [challans, itemsByCh, maps, categories, q])

  const cols: RepCol[] = [
    { key: 'date', header: 'Date', width: '7%' },
    { key: 'challan_no', header: 'Challan', width: '10%' },
    { key: 'invoice', header: 'SAP Invoice', width: '9%' },
    { key: 'party', header: 'Party', width: '15%' },
    { key: 'from', header: 'Load From', width: '12%' },
    { key: 'to', header: 'Offload To', width: '11%' },
    { key: 'carrier', header: 'Vehicle / Courier', width: '14%' },
    ...categories.map(c => ({ key: c, header: c, align: 'right' as const })),
    { key: 'total', header: 'Total', align: 'right', width: '5%' },
    { key: 'cost', header: 'Cost', align: 'right', width: '6%' },
    { key: 'status', header: 'Status', width: '6%' }
  ]
  const tableCols = [
    { key: 'date', header: 'Date', accessor: (r: any) => r.date, sortable: true },
    { key: 'challan_no', header: 'Challan', accessor: (r: any) => r.challan_no, className: 'font-medium', sortable: true },
    { key: 'invoice', header: 'SAP Invoice', accessor: (r: any) => r.invoice },
    { key: 'party', header: 'Party', accessor: (r: any) => r.party, sortable: true },
    { key: 'from', header: 'Load From', accessor: (r: any) => r.from },
    { key: 'to', header: 'Offload To', accessor: (r: any) => r.to },
    { key: 'mode', header: 'Mode', accessor: (r: any) => r.mode },
    { key: 'carrier', header: 'Vehicle / Courier', accessor: (r: any) => r.carrier },
    ...categories.map(c => ({ key: c, header: c, className: 'text-right', accessor: (r: any) => r[c] ? formatNumber(r[c]) : '' })),
    { key: 'total', header: 'Total', className: 'text-right font-semibold', accessor: (r: any) => formatNumber(r.total), sortable: true },
    { key: 'cost', header: 'Cost', className: 'text-right', accessor: (r: any) => r.cost ? formatNumber(r.cost) : '', sortable: true },
    { key: 'status', header: 'Status', accessor: (r: any) => r.status }
  ]

  if (loading) return <Spinner label="Loading…" />
  const totalQty = rows.reduce((s: number, r: any) => s + r.total, 0)
  const totalCost = rows.reduce((s: number, r: any) => s + r.cost, 0)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportToolbar count={rows.length}
        onCSV={() => downloadCSV('Outbound Transport Report', cols, rows)}
        onPDF={() => downloadReportPDF('Outbound Transport Report', `${rows.length} despatches · ${formatNumber(totalQty)} units · cost ${formatNumber(totalCost)}`, cols, rows)}>
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search challan / invoice / party…" /></div>
      </ReportToolbar>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={tableCols} rows={rows} rowKey={(r: any) => r.challan_no} emptyTitle="No despatches yet" />
      </Card>
      <p className="text-xs text-ink-faint">One row per delivery challan. Category columns are discovered from the despatched products; transport vendor / vehicle come from the challan's transport details.</p>
    </div>
  )
}
