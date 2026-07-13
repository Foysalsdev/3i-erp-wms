import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatNumber } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '../export'

const INVOICED = ['invoiced', 'dispatched', 'delivered', 'closed']
import type { Tables } from '@/types/database.types'

type OrderSlice = Pick<Tables<'sales_orders'>, 'id' | 'customer_id' | 'created_by' | 'total_qty' | 'total_amount' | 'status'>
interface SalesGroup { group: string; division: string; orders: number; order_qty: number; order_value: number; invoiced_qty: number; delivered_qty: number }
type SalesRow = SalesGroup & { pending_qty: number } & Record<string, string | number>

const n = (v: number | string | null | undefined) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

// Sales performance grouped by Customer or by Salesman (order creator).
// Order -> Invoiced -> Delivered -> Pending, per group.
export function SalesReport() {
  const { currentClientId } = useAuth()
  const [by, setBy] = useState<'customer' | 'salesman'>('customer')
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderSlice[]>([])
  const [delivered, setDelivered] = useState<Record<string, number>>({})
  const [customers, setCustomers] = useState<Record<string, string>>({})
  const [people, setPeople] = useState<Record<string, string>>({})
  const [peopleDiv, setPeopleDiv] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    Promise.all([
      supabase.from('sales_orders').select('id,customer_id,created_by,total_qty,total_amount,status'),
      supabase.from('sales_order_items').select('so_id,delivered_qty'),
      supabase.from('customers').select('id,customer_code,name'),
      supabase.from('profiles').select('id,full_name,division')
    ]).then(([o, it, c, p]) => {
      setOrders(o.data ?? [])
      const d: Record<string, number> = {}
      ;(it.data ?? []).forEach(r => { d[r.so_id] = (d[r.so_id] ?? 0) + n(r.delivered_qty) })
      setDelivered(d)
      const cm: Record<string, string> = {}; (c.data ?? []).forEach(r => { cm[r.id] = `${r.customer_code} — ${r.name}` })
      setCustomers(cm)
      const pm: Record<string, string> = {}; const pd: Record<string, string> = {}; (p.data ?? []).forEach(r => { pm[r.id] = r.full_name || '—'; pd[r.id] = r.division || '' })
      setPeople(pm); setPeopleDiv(pd)
      setLoading(false)
    })
  }, [currentClientId])

  const rows = useMemo(() => {
    const agg: Record<string, SalesGroup> = {}
    for (const o of orders) {
      const key = by === 'customer' ? (o.customer_id || 'none') : (o.created_by || 'none')
      const name = by === 'customer' ? (customers[o.customer_id ?? ''] ?? '— (no customer)') : (people[o.created_by ?? ''] ?? '— (unknown)')
      const division = by === 'salesman' ? (peopleDiv[o.created_by ?? ''] || '—') : ''
      const g = agg[key] ?? (agg[key] = { group: name, division, orders: 0, order_qty: 0, order_value: 0, invoiced_qty: 0, delivered_qty: 0 })
      g.orders += 1
      g.order_qty += n(o.total_qty)
      g.order_value += n(o.total_amount)
      if (INVOICED.includes(o.status ?? '')) g.invoiced_qty += n(o.total_qty)
      g.delivered_qty += n(delivered[o.id])
    }
    return Object.values(agg).map((g): SalesRow => ({ ...g, pending_qty: Math.max(0, g.order_qty - g.delivered_qty) }))
      .sort((a, b) => b.order_qty - a.order_qty)
  }, [orders, delivered, customers, people, peopleDiv, by])

  const cols: RepCol[] = [
    { key: 'group', header: by === 'customer' ? 'Customer' : 'Salesman' },
    ...(by === 'salesman' ? [{ key: 'division', header: 'Division', width: '12%' } as RepCol] : []),
    { key: 'orders', header: 'Orders', align: 'right', width: '9%' },
    { key: 'order_qty', header: 'Order Qty', align: 'right', width: '12%' },
    { key: 'order_value', header: 'Order Value', align: 'right', width: '14%' },
    { key: 'invoiced_qty', header: 'Invoiced Qty', align: 'right', width: '12%' },
    { key: 'delivered_qty', header: 'Delivered Qty', align: 'right', width: '12%' },
    { key: 'pending_qty', header: 'Pending Qty', align: 'right', width: '12%' }
  ]
  const tableCols = cols.map(c => ({
    key: c.key, header: c.header, className: c.align === 'right' ? 'text-right' : '', sortable: true,
    accessor: (r: SalesRow) => r[c.key],
    render: (r: SalesRow) => c.key === 'group' ? r.group : formatNumber(Number(r[c.key]), c.key === 'order_value' ? 2 : 0)
  }))
  const exportRows = rows.map(r => ({ ...r, order_value: r.order_value.toFixed(2) }))
  const title = by === 'customer' ? 'Sales by Customer' : 'Sales by Salesman'
  const chartData = rows.slice(0, 8).map(r => ({ name: r.group.split(' — ')[0].slice(0, 12), Order: r.order_qty, Delivered: r.delivered_qty, Pending: r.pending_qty }))

  if (loading) return <TableSkeleton rows={8} cols={6} />
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportToolbar count={rows.length} onCSV={() => downloadCSV(title, cols, exportRows)} onPDF={() => downloadReportPDF(title, 'Order / Invoiced / Delivered / Pending', cols, exportRows)}>
        <div className="flex rounded-lg border border-surface-line p-0.5 text-sm">
          <button onClick={() => setBy('customer')} className={'rounded-md px-3 py-1 font-medium ' + (by === 'customer' ? 'bg-brand-500 text-white' : 'text-ink-soft')}>By Customer</button>
          <button onClick={() => setBy('salesman')} className={'rounded-md px-3 py-1 font-medium ' + (by === 'salesman' ? 'bg-brand-500 text-white' : 'text-ink-soft')}>By Salesman</button>
        </div>
      </ReportToolbar>

      {chartData.length > 0 && (
        <Card className="p-3">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
              <Bar dataKey="Order" fill="#1f3a93" /><Bar dataKey="Delivered" fill="#16a34a" /><Bar dataKey="Pending" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={tableCols} rows={rows} rowKey={r => r.group} emptyTitle="No sales orders yet" />
      </Card>
    </div>
  )
}
