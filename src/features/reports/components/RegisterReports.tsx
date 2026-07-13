import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatNumber, formatDate } from '@/lib/utils'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '../export'

const n = (v: number | string | null | undefined) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

function useClientRows<K extends keyof import('@/types/database.types').Database['public']['Tables']>(table: K) {
  const { currentClientId } = useAuth()
  const [rows, setRows] = useState<Tables<K>[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    // one dynamic seam: a generic table union is too deep for the typed client
    supabase.from(table as any).select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setRows((data ?? []) as Tables<K>[]); setLoading(false) })
  }, [currentClientId, table])
  return { rows, loading, currentClientId }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <Card className="p-3"><p className="text-xs text-ink-faint">{label}</p><p className="mt-1 text-xl font-bold text-ink">{value}</p></Card>
}

// ---- Inbound (Goods Receipts) ---------------------------------------------
export function InboundReport() {
  const { rows, loading, currentClientId } = useClientRows('goods_receipts')
  const [suppliers, setSuppliers] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!currentClientId) return
    supabase.from('suppliers').select('id,supplier_code,name').then(({ data }) => {
      const m: Record<string, string> = {}; (data ?? []).forEach(s => { m[s.id] = `${s.supplier_code} — ${s.name}` }); setSuppliers(m)
    })
  }, [currentClientId])
  const data = useMemo(() => rows.map(r => ({
    grn_no: r.grn_no ?? '', sap_miro: r.sap_miro_ref ?? '', supplier: suppliers[r.supplier_id ?? ''] ?? '—',
    receipt_date: formatDate(r.receipt_date), total_qty: n(r.total_qty), status: r.status, billable: r.billable ? 'Yes' : 'No'
  })), [rows, suppliers])
  const cols: RepCol[] = [
    { key: 'grn_no', header: 'GRN No', width: '15%' }, { key: 'sap_miro', header: 'SAP MIRO', width: '13%' },
    { key: 'supplier', header: 'Supplier', width: '28%' }, { key: 'receipt_date', header: 'Date', width: '13%' },
    { key: 'total_qty', header: 'Qty', align: 'right', width: '10%' }, { key: 'status', header: 'Status', width: '11%' },
    { key: 'billable', header: 'Billable', width: '10%' }
  ]
  const tableCols: Column<(typeof data)[number]>[] = [
    { key: 'grn_no', header: 'GRN No', accessor: r => r.grn_no, className: 'font-medium' },
    { key: 'sap_miro', header: 'SAP MIRO', accessor: r => r.sap_miro },
    { key: 'supplier', header: 'Supplier', accessor: r => r.supplier },
    { key: 'receipt_date', header: 'Date', accessor: r => r.receipt_date },
    { key: 'total_qty', header: 'Qty', className: 'text-right', accessor: r => formatNumber(r.total_qty) },
    { key: 'status', header: 'Status', render: r => <Badge tone={r.status === 'approved' ? 'positive' : r.status === 'cancelled' ? 'negative' : 'info'}>{r.status}</Badge> }
  ]
  if (loading) return <TableSkeleton rows={8} cols={6} />
  const totalQty = data.reduce((s, r) => s + r.total_qty, 0)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportToolbar count={data.length} onCSV={() => downloadCSV('Inbound Report', cols, data)} onPDF={() => downloadReportPDF('Inbound (Goods Receipts) Report', `${data.length} receipts · ${formatNumber(totalQty)} units`, cols, data)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Receipts" value={formatNumber(data.length)} />
        <StatCard label="Total Units Received" value={formatNumber(totalQty)} />
        <StatCard label="Billable" value={formatNumber(data.filter(r => r.billable === 'Yes').length)} />
      </div>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden"><DataTable fill columns={tableCols} rows={data} rowKey={r => r.grn_no + r.sap_miro} emptyTitle="No goods receipts" /></Card>
    </div>
  )
}

// ---- Asset register --------------------------------------------------------
export function AssetReport() {
  const { rows, loading } = useClientRows('assets')
  const data = useMemo(() => rows.map(r => ({
    asset_code: r.asset_code ?? '', name: r.name ?? '', category: r.category ?? '—',
    purchase_date: formatDate(r.purchase_date), purchase_cost: n(r.purchase_cost),
    assigned_to: r.assigned_to ?? '—', status: r.status ?? '—'
  })), [rows])
  const cols: RepCol[] = [
    { key: 'asset_code', header: 'Asset Code', width: '14%' }, { key: 'name', header: 'Name', width: '24%' },
    { key: 'category', header: 'Category', width: '15%' }, { key: 'purchase_date', header: 'Purchased', width: '13%' },
    { key: 'purchase_cost', header: 'Cost', align: 'right', width: '12%' }, { key: 'assigned_to', header: 'Assigned', width: '12%' },
    { key: 'status', header: 'Status', width: '10%' }
  ]
  const csv = useMemo(() => data.map(r => ({ ...r, purchase_cost: r.purchase_cost.toFixed(2) })), [data])
  const tableCols: Column<(typeof data)[number]>[] = [
    { key: 'asset_code', header: 'Asset Code', accessor: r => r.asset_code, className: 'font-medium' },
    { key: 'name', header: 'Name', accessor: r => r.name },
    { key: 'category', header: 'Category', accessor: r => r.category },
    { key: 'purchase_date', header: 'Purchased', accessor: r => r.purchase_date },
    { key: 'purchase_cost', header: 'Cost', className: 'text-right', accessor: r => formatNumber(r.purchase_cost, 2) },
    { key: 'assigned_to', header: 'Assigned', accessor: r => r.assigned_to },
    { key: 'status', header: 'Status', render: r => <Badge tone={r.status === 'active' ? 'positive' : 'neutral'}>{r.status}</Badge> }
  ]
  if (loading) return <TableSkeleton rows={8} cols={6} />
  const totalCost = data.reduce((s, r) => s + r.purchase_cost, 0)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportToolbar count={data.length} onCSV={() => downloadCSV('Asset Register', cols, csv)} onPDF={() => downloadReportPDF('Asset Register Report', `${data.length} assets · value ${formatNumber(totalCost, 2)}`, cols, csv)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Assets" value={formatNumber(data.length)} />
        <StatCard label="Total Value" value={formatNumber(totalCost, 2)} />
        <StatCard label="Active" value={formatNumber(data.filter(r => r.status === 'active').length)} />
      </div>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden"><DataTable fill columns={tableCols} rows={data} rowKey={r => r.asset_code} emptyTitle="No assets registered" /></Card>
    </div>
  )
}

// ---- HR (Employees) --------------------------------------------------------
export function HrReport() {
  const { rows, loading } = useClientRows('employees')
  const data = useMemo(() => rows.map((r: any) => ({
    employee_code: r.employee_code ?? '', name: r.name ?? '', designation: r.designation ?? '—',
    department: r.department ?? '—', joining_date: formatDate(r.joining_date), status: r.status ?? '—'
  })), [rows])
  const cols: RepCol[] = [
    { key: 'employee_code', header: 'Code', width: '13%' }, { key: 'name', header: 'Name', width: '24%' },
    { key: 'designation', header: 'Designation', width: '20%' }, { key: 'department', header: 'Department', width: '18%' },
    { key: 'joining_date', header: 'Joined', width: '13%' }, { key: 'status', header: 'Status', width: '12%' }
  ]
  const tableCols: Column<(typeof data)[number]>[] = [
    { key: 'employee_code', header: 'Code', accessor: r => r.employee_code, className: 'font-medium' },
    { key: 'name', header: 'Name', accessor: r => r.name },
    { key: 'designation', header: 'Designation', accessor: r => r.designation },
    { key: 'department', header: 'Department', accessor: r => r.department },
    { key: 'joining_date', header: 'Joined', accessor: r => r.joining_date },
    { key: 'status', header: 'Status', render: r => <Badge tone={r.status === 'active' ? 'positive' : 'neutral'}>{r.status}</Badge> }
  ]
  if (loading) return <TableSkeleton rows={8} cols={6} />
  const byDept = data.reduce((m: Record<string, number>, r) => { m[r.department] = (m[r.department] ?? 0) + 1; return m }, {})
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportToolbar count={data.length} onCSV={() => downloadCSV('HR Report', cols, data)} onPDF={() => downloadReportPDF('HR (Employees) Report', `${data.length} employees`, cols, data)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Employees" value={formatNumber(data.length)} />
        <StatCard label="Active" value={formatNumber(data.filter(r => r.status === 'active').length)} />
        <StatCard label="Departments" value={formatNumber(Object.keys(byDept).length)} />
      </div>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden"><DataTable fill columns={tableCols} rows={data} rowKey={r => r.employee_code} emptyTitle="No employees" /></Card>
    </div>
  )
}

// ---- Delivery register: every challan line — which transport/courier carried which product --
// index signature so the row doubles as a CSV/PDF export row
type DeliveryLine = {
  challan_no: string; date: string; so_no: string; customer: string
  mode: string; carrier: string; status: string; product: string; qty: number; key: string
} & Record<string, string | number>
export function DeliveryRegisterReport() {
  const { currentClientId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DeliveryLine[]>([])
  const [mode, setMode] = useState<'all' | 'transport' | 'courier'>('all')

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    ;(async () => {
      const { data: chs } = await supabase.from('delivery_challans')
        .select('id,challan_no,challan_date,status,posted_at,delivery_method,driver_name,transport_vendor,courier_name,courier_tracking_no,po_no,customer_id,sales_order_id')
        .order('challan_date', { ascending: false })
      const ids = (chs ?? []).map(c => c.id)
      const [{ data: items }, { data: customers }, { data: sos }, { data: products }] = await Promise.all([
        ids.length ? supabase.from('delivery_challan_items').select('challan_id,product_id,qty').in('challan_id', ids) : Promise.resolve({ data: [] as Pick<Tables<'delivery_challan_items'>, 'challan_id' | 'product_id' | 'qty'>[] }),
        supabase.from('customers').select('id,customer_code,name'),
        supabase.from('sales_orders').select('id,so_no'),
        supabase.from('products').select('id,material_code,name')
      ])
      const custMap: Record<string, string> = {}; (customers ?? []).forEach(c => { custMap[c.id] = `${c.customer_code} — ${c.name}` })
      const soMap: Record<string, string> = {}; (sos ?? []).forEach(s => { soMap[s.id] = s.so_no })
      const prodMap: Record<string, string> = {}; (products ?? []).forEach(p => { prodMap[p.id] = `${p.material_code} — ${p.name}` })
      type ChItem = Pick<Tables<'delivery_challan_items'>, 'challan_id' | 'product_id' | 'qty'>
      const byCh: Record<string, ChItem[]> = {}; (items ?? []).forEach(it => { (byCh[it.challan_id] ??= []).push(it) })

      const out: DeliveryLine[] = []
      ;(chs ?? []).forEach(c => {
        const courier = c.delivery_method === 'courier'
        const carrier = courier
          ? `${c.courier_name || '—'}${c.courier_tracking_no ? ` (${c.courier_tracking_no})` : ''}`
          : (c.transport_vendor || c.driver_name || '—')
        const status = c.posted_at ? 'issued' : (c.status ?? 'draft')
        const lines = byCh[c.id] ?? []
        const common = {
          challan_no: c.challan_no, date: formatDate(c.challan_date), so_no: soMap[c.sales_order_id ?? ''] ?? (c.po_no ?? '—'),
          customer: custMap[c.customer_id ?? ''] ?? '—', mode: courier ? 'Courier' : 'Transport', carrier, status
        }
        if (lines.length === 0) out.push({ ...common, product: '—', qty: 0, key: `${c.id}-0` })
        else lines.forEach((it, i) => out.push({ ...common, product: prodMap[it.product_id ?? ''] ?? '—', qty: n(it.qty), key: `${c.id}-${i}` }))
      })
      setRows(out)
      setLoading(false)
    })()
  }, [currentClientId])

  const filtered = useMemo(() => mode === 'all' ? rows : rows.filter(r => r.mode.toLowerCase() === mode), [rows, mode])

  const cols: RepCol[] = [
    { key: 'challan_no', header: 'Challan No', width: '11%' }, { key: 'date', header: 'Date', width: '9%' },
    { key: 'so_no', header: 'SO / Ref', width: '10%' }, { key: 'customer', header: 'Customer', width: '20%' },
    { key: 'mode', header: 'Mode', width: '8%' }, { key: 'carrier', header: 'Carrier', width: '15%' },
    { key: 'product', header: 'Product', width: '17%' }, { key: 'qty', header: 'Qty', align: 'right', width: '6%' },
    { key: 'status', header: 'Status', width: '8%' }
  ]
  const tableCols: Column<DeliveryLine>[] = [
    { key: 'challan_no', header: 'Challan No', accessor: r => r.challan_no, className: 'font-medium' },
    { key: 'date', header: 'Date', accessor: r => r.date },
    { key: 'so_no', header: 'SO / Ref', accessor: r => r.so_no },
    { key: 'customer', header: 'Customer', accessor: r => r.customer },
    { key: 'mode', header: 'Mode', render: r => <Badge tone={r.mode === 'Courier' ? 'info' : 'neutral'}>{r.mode}</Badge> },
    { key: 'carrier', header: 'Carrier', accessor: r => r.carrier },
    { key: 'product', header: 'Product', accessor: r => r.product },
    { key: 'qty', header: 'Qty', className: 'text-right', accessor: r => formatNumber(r.qty) },
    { key: 'status', header: 'Status', render: r => <Badge tone={r.status === 'issued' ? 'positive' : r.status === 'cancelled' ? 'negative' : 'neutral'}>{r.status}</Badge> }
  ]
  if (loading) return <TableSkeleton rows={8} cols={6} />
  const challanCount = new Set(filtered.map(r => r.challan_no)).size
  const totalQty = filtered.reduce((s, r) => s + r.qty, 0)
  const courierCount = new Set(rows.filter(r => r.mode === 'Courier').map(r => r.challan_no)).size
  const transportCount = new Set(rows.filter(r => r.mode === 'Transport').map(r => r.challan_no)).size

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportToolbar count={filtered.length} onCSV={() => downloadCSV('Delivery Register', cols, filtered)} onPDF={() => downloadReportPDF('Delivery Register', `Which transport/courier carried what · ${challanCount} deliveries`, cols, filtered)}>
        <div className="flex rounded-lg border border-surface-line p-0.5 text-sm">
          <button onClick={() => setMode('all')} className={'rounded-md px-3 py-1 font-medium ' + (mode === 'all' ? 'bg-brand-500 text-white' : 'text-ink-soft')}>All</button>
          <button onClick={() => setMode('transport')} className={'rounded-md px-3 py-1 font-medium ' + (mode === 'transport' ? 'bg-brand-500 text-white' : 'text-ink-soft')}>Transport</button>
          <button onClick={() => setMode('courier')} className={'rounded-md px-3 py-1 font-medium ' + (mode === 'courier' ? 'bg-brand-500 text-white' : 'text-ink-soft')}>Courier</button>
        </div>
      </ReportToolbar>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Deliveries" value={formatNumber(challanCount)} />
        <StatCard label="Units Shipped" value={formatNumber(totalQty)} />
        <StatCard label="By Transport" value={formatNumber(transportCount)} />
        <StatCard label="By Courier" value={formatNumber(courierCount)} />
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={tableCols} rows={filtered} rowKey={r => r.key} emptyTitle="No deliveries yet" />
      </Card>
    </div>
  )
}
