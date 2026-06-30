import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/States'
import { formatNumber, formatDate } from '@/lib/utils'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '../export'

const n = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

function useClientRows(table: string) {
  const { currentClientId } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    supabase.from(table as any).select('*').eq('client_id', currentClientId).order('created_at', { ascending: false })
      .then(({ data }: any) => { setRows(data ?? []); setLoading(false) })
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
    supabase.from('suppliers').select('id,supplier_code,name').eq('client_id', currentClientId).then(({ data }) => {
      const m: Record<string, string> = {}; (data ?? []).forEach((s: any) => { m[s.id] = `${s.supplier_code} — ${s.name}` }); setSuppliers(m)
    })
  }, [currentClientId])
  const data = useMemo(() => rows.map(r => ({
    grn_no: r.grn_no ?? '', sap_miro: r.sap_miro_ref ?? '', supplier: suppliers[r.supplier_id] ?? '—',
    receipt_date: formatDate(r.receipt_date), total_qty: n(r.total_qty), status: r.status, billable: r.billable ? 'Yes' : 'No'
  })), [rows, suppliers])
  const cols: RepCol[] = [
    { key: 'grn_no', header: 'GRN No', width: '15%' }, { key: 'sap_miro', header: 'SAP MIRO', width: '13%' },
    { key: 'supplier', header: 'Supplier', width: '28%' }, { key: 'receipt_date', header: 'Date', width: '13%' },
    { key: 'total_qty', header: 'Qty', align: 'right', width: '10%' }, { key: 'status', header: 'Status', width: '11%' },
    { key: 'billable', header: 'Billable', width: '10%' }
  ]
  const tableCols = [
    { key: 'grn_no', header: 'GRN No', accessor: (r: any) => r.grn_no, className: 'font-medium' },
    { key: 'sap_miro', header: 'SAP MIRO', accessor: (r: any) => r.sap_miro },
    { key: 'supplier', header: 'Supplier', accessor: (r: any) => r.supplier },
    { key: 'receipt_date', header: 'Date', accessor: (r: any) => r.receipt_date },
    { key: 'total_qty', header: 'Qty', className: 'text-right', accessor: (r: any) => formatNumber(r.total_qty) },
    { key: 'status', header: 'Status', render: (r: any) => <Badge tone={r.status === 'approved' ? 'positive' : r.status === 'cancelled' ? 'negative' : 'info'}>{r.status}</Badge> }
  ]
  if (loading) return <Spinner label="Loading…" />
  const totalQty = data.reduce((s, r) => s + r.total_qty, 0)
  return (
    <div className="space-y-4">
      <ReportToolbar count={data.length} onCSV={() => downloadCSV('Inbound Report', cols, data)} onPDF={() => downloadReportPDF('Inbound (Goods Receipts) Report', `${data.length} receipts · ${formatNumber(totalQty)} units`, cols, data)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Receipts" value={formatNumber(data.length)} />
        <StatCard label="Total Units Received" value={formatNumber(totalQty)} />
        <StatCard label="Billable" value={formatNumber(data.filter(r => r.billable === 'Yes').length)} />
      </div>
      <Card className="overflow-hidden"><DataTable columns={tableCols} rows={data} rowKey={(r: any) => r.grn_no + r.sap_miro} emptyTitle="No goods receipts" /></Card>
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
  const tableCols = [
    { key: 'asset_code', header: 'Asset Code', accessor: (r: any) => r.asset_code, className: 'font-medium' },
    { key: 'name', header: 'Name', accessor: (r: any) => r.name },
    { key: 'category', header: 'Category', accessor: (r: any) => r.category },
    { key: 'purchase_date', header: 'Purchased', accessor: (r: any) => r.purchase_date },
    { key: 'purchase_cost', header: 'Cost', className: 'text-right', accessor: (r: any) => formatNumber(r.purchase_cost, 2) },
    { key: 'assigned_to', header: 'Assigned', accessor: (r: any) => r.assigned_to },
    { key: 'status', header: 'Status', render: (r: any) => <Badge tone={r.status === 'active' ? 'positive' : 'neutral'}>{r.status}</Badge> }
  ]
  if (loading) return <Spinner label="Loading…" />
  const totalCost = data.reduce((s, r) => s + r.purchase_cost, 0)
  return (
    <div className="space-y-4">
      <ReportToolbar count={data.length} onCSV={() => downloadCSV('Asset Register', cols, csv)} onPDF={() => downloadReportPDF('Asset Register Report', `${data.length} assets · value ${formatNumber(totalCost, 2)}`, cols, csv)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Assets" value={formatNumber(data.length)} />
        <StatCard label="Total Value" value={formatNumber(totalCost, 2)} />
        <StatCard label="Active" value={formatNumber(data.filter(r => r.status === 'active').length)} />
      </div>
      <Card className="overflow-hidden"><DataTable columns={tableCols} rows={data} rowKey={(r: any) => r.asset_code} emptyTitle="No assets registered" /></Card>
    </div>
  )
}

// ---- Finance (Customer Billing) -------------------------------------------
export function FinanceReport() {
  const { rows, loading, currentClientId } = useClientRows('billing_invoices')
  const [customers, setCustomers] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!currentClientId) return
    supabase.from('customers').select('id,customer_code,name').eq('client_id', currentClientId).then(({ data }) => {
      const m: Record<string, string> = {}; (data ?? []).forEach((c: any) => { m[c.id] = `${c.customer_code} — ${c.name}` }); setCustomers(m)
    })
  }, [currentClientId])
  const data = useMemo(() => rows.map(r => ({
    invoice_no: r.invoice_no ?? '', customer: customers[r.customer_id] ?? '—', invoice_date: formatDate(r.invoice_date),
    total: n(r.total), status: r.status ?? '—'
  })), [rows, customers])
  const cols: RepCol[] = [
    { key: 'invoice_no', header: 'Invoice No', width: '18%' }, { key: 'customer', header: 'Customer', width: '38%' },
    { key: 'invoice_date', header: 'Date', width: '15%' }, { key: 'total', header: 'Total', align: 'right', width: '15%' },
    { key: 'status', header: 'Status', width: '14%' }
  ]
  const csv = useMemo(() => data.map(r => ({ ...r, total: r.total.toFixed(2) })), [data])
  const tableCols = [
    { key: 'invoice_no', header: 'Invoice No', accessor: (r: any) => r.invoice_no, className: 'font-medium' },
    { key: 'customer', header: 'Customer', accessor: (r: any) => r.customer },
    { key: 'invoice_date', header: 'Date', accessor: (r: any) => r.invoice_date },
    { key: 'total', header: 'Total', className: 'text-right', accessor: (r: any) => formatNumber(r.total, 2) },
    { key: 'status', header: 'Status', render: (r: any) => <Badge tone={r.status === 'paid' ? 'positive' : r.status === 'cancelled' ? 'negative' : 'info'}>{r.status}</Badge> }
  ]
  if (loading) return <Spinner label="Loading…" />
  const billed = data.reduce((s, r) => s + r.total, 0)
  const paid = data.filter(r => r.status === 'paid').reduce((s, r) => s + r.total, 0)
  return (
    <div className="space-y-4">
      <ReportToolbar count={data.length} onCSV={() => downloadCSV('Finance Report', cols, csv)} onPDF={() => downloadReportPDF('Finance (Billing) Report', `Billed ${formatNumber(billed, 2)} · Paid ${formatNumber(paid, 2)}`, cols, csv)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Invoices" value={formatNumber(data.length)} />
        <StatCard label="Total Billed" value={formatNumber(billed, 2)} />
        <StatCard label="Outstanding" value={formatNumber(billed - paid, 2)} />
      </div>
      <Card className="overflow-hidden"><DataTable columns={tableCols} rows={data} rowKey={(r: any) => r.invoice_no} emptyTitle="No invoices" /></Card>
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
  const tableCols = [
    { key: 'employee_code', header: 'Code', accessor: (r: any) => r.employee_code, className: 'font-medium' },
    { key: 'name', header: 'Name', accessor: (r: any) => r.name },
    { key: 'designation', header: 'Designation', accessor: (r: any) => r.designation },
    { key: 'department', header: 'Department', accessor: (r: any) => r.department },
    { key: 'joining_date', header: 'Joined', accessor: (r: any) => r.joining_date },
    { key: 'status', header: 'Status', render: (r: any) => <Badge tone={r.status === 'active' ? 'positive' : 'neutral'}>{r.status}</Badge> }
  ]
  if (loading) return <Spinner label="Loading…" />
  const byDept = data.reduce((m: Record<string, number>, r) => { m[r.department] = (m[r.department] ?? 0) + 1; return m }, {})
  return (
    <div className="space-y-4">
      <ReportToolbar count={data.length} onCSV={() => downloadCSV('HR Report', cols, data)} onPDF={() => downloadReportPDF('HR (Employees) Report', `${data.length} employees`, cols, data)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Employees" value={formatNumber(data.length)} />
        <StatCard label="Active" value={formatNumber(data.filter(r => r.status === 'active').length)} />
        <StatCard label="Departments" value={formatNumber(Object.keys(byDept).length)} />
      </div>
      <Card className="overflow-hidden"><DataTable columns={tableCols} rows={data} rowKey={(r: any) => r.employee_code} emptyTitle="No employees" /></Card>
    </div>
  )
}
