import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Segmented } from '@/components/ui/Segmented'
import { SearchBar } from '@/components/shared/SearchBar'
import { formatNumber, formatDate, formatDateTime } from '@/lib/utils'
import { downloadCSV, downloadReportPDF, type RepCol } from '@/features/reports/export'
import { fetchStockAvailability } from '@/lib/stockAvailability'
import type { Tables } from '@/types/database.types'

type SalesOrderRow = Pick<Tables<'sales_orders'>,
  'id' | 'so_no' | 'customer_id' | 'order_date' | 'total_qty' | 'total_amount' | 'status' | 'billing_doc_no'>
type ProductRow = Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'category' | 'uom'>
type StockRow = { code: string; name: string; category: string; uom: string; available: number }

const n = (v: number | string | null | undefined) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const today = () => new Date().toISOString().slice(0, 10)
const INVOICED = ['invoiced', 'dispatched', 'delivered', 'closed']
const DELIVERED = ['delivered', 'closed']
const STAGES = ['Order', 'Picked', 'Invoiced', 'Dispatched', 'Delivered']
const stageIndex = (s: string): number => {
  if (['draft', 'pending', 'approved'].includes(s)) return 0
  if (['picking', 'packed'].includes(s)) return 1
  if (s === 'invoiced') return 2
  if (s === 'dispatched') return 3
  if (['delivered', 'closed'].includes(s)) return 4
  return 0
}
const tone = (s: string) => DELIVERED.includes(s) ? 'positive' : s === 'cancelled' ? 'negative' : s === 'draft' ? 'neutral' : ['dispatched', 'packed', 'picking'].includes(s) ? 'info' : 'critical'

function Stepper({ status }: { status: string }) {
  if (status === 'cancelled') return <Badge tone="negative">Cancelled</Badge>
  const cur = stageIndex(status)
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((label, i) => (
        <div key={label} className="flex flex-1 items-center" style={{ minWidth: 40 }}>
          <div className="flex flex-col items-center gap-1">
            <div className={'flex h-5 w-5 items-center justify-center rounded-full text-[10px] ' + (i <= cur ? 'bg-brand-500 text-white' : 'border border-surface-line bg-surface text-ink-faint')}>
              {i <= cur ? <Icon name="check" className="text-[12px]" /> : i + 1}
            </div>
            <span className={'whitespace-nowrap text-[9px] ' + (i === cur ? 'font-semibold text-ink' : 'text-ink-faint')}>{label}</span>
          </div>
          {i < STAGES.length - 1 && <div className={'mx-0.5 h-0.5 flex-1 rounded ' + (i < cur ? 'bg-brand-500' : 'bg-surface-line')} />}
        </div>
      ))}
    </div>
  )
}

// A salesman's own order board: KPIs + their orders with progress, plus a
// read-only Saleable Stock view so they know what they can sell.
export default function SalesmanBoard() {
  const uid = useAuth(s => s.session)?.user.id
  const { currentClientId, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'orders' | 'stock'>('orders')
  const [orders, setOrders] = useState<SalesOrderRow[]>([])
  const [delivered, setDelivered] = useState<Record<string, number>>({})
  const [customers, setCustomers] = useState<Record<string, string>>({})
  const [avail, setAvail] = useState<Record<string, number>>({})
  const [prodMap, setProdMap] = useState<Record<string, ProductRow>>({})
  const [q, setQ] = useState('')
  const [sq, setSq] = useState('')
  const [view, setView] = useState<SalesOrderRow | null>(null)

  useEffect(() => {
    if (!currentClientId || !uid) return
    setLoading(true)
    Promise.all([
      supabase.from('sales_orders').select('id,so_no,customer_id,order_date,total_qty,total_amount,status,billing_doc_no').eq('created_by', uid).order('created_at', { ascending: false }),
      supabase.from('sales_order_items').select('so_id,delivered_qty'),
      supabase.from('customers').select('id,customer_code,name'),
      fetchStockAvailability(currentClientId),
      supabase.from('products').select('id,material_code,name,category,uom')
    ]).then(([o, it, c, stockAvail, pr]) => {
      setOrders(o.data ?? [])
      const d: Record<string, number> = {}; (it.data ?? []).forEach(r => { if (r.so_id) d[r.so_id] = (d[r.so_id] ?? 0) + n(r.delivered_qty) })
      setDelivered(d)
      const cm: Record<string, string> = {}; (c.data ?? []).forEach(r => { cm[r.id] = `${r.customer_code} — ${r.name}` })
      setCustomers(cm)
      setAvail(Object.fromEntries(Object.entries(stockAvail).map(([pid, a]) => [pid, a.saleable])))
      const pm: Record<string, ProductRow> = {}; (pr.data ?? []).forEach(r => { pm[r.id] = r })
      setProdMap(pm); setLoading(false)
    })
  }, [currentClientId, uid])

  const kpi = useMemo(() => {
    const t = today()
    return {
      total: orders.length,
      todayCount: orders.filter(o => o.order_date === t).length,
      invoiced: orders.filter(o => INVOICED.includes(o.status)).length,
      delivered: orders.filter(o => DELIVERED.includes(o.status)).length,
      pending: orders.filter(o => !DELIVERED.includes(o.status) && o.status !== 'cancelled').length
    }
  }, [orders])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return orders.filter(o => !t || String(o.so_no).toLowerCase().includes(t) || (customers[o.customer_id ?? ''] ?? '').toLowerCase().includes(t))
  }, [orders, customers, q])

  const stockRows = useMemo(() => {
    const t = sq.trim().toLowerCase()
    return Object.entries(avail)
      .map(([pid, available]): StockRow | null => { const p = prodMap[pid]; return p ? { code: p.material_code, name: p.name, category: p.category || '—', uom: p.uom || '', available } : null })
      .filter((g): g is StockRow => !!g && g.available !== 0)
      .filter(g => !t || g.code.toLowerCase().includes(t) || g.name.toLowerCase().includes(t) || g.category.toLowerCase().includes(t))
      .sort((a, b) => b.available - a.available)
  }, [avail, prodMap, sq])

  const exportCols: RepCol[] = [
    { key: 'so_no', header: 'SO No' }, { key: 'customer', header: 'Customer' }, { key: 'date', header: 'Date' },
    { key: 'qty', header: 'Qty', align: 'right' }, { key: 'delivered', header: 'Delivered', align: 'right' },
    { key: 'pending', header: 'Pending', align: 'right' }, { key: 'status', header: 'Status' }
  ]
  const exportRows = rows.map(o => ({ so_no: o.so_no, customer: customers[o.customer_id ?? ''] ?? '—', date: formatDate(o.order_date), qty: n(o.total_qty), delivered: n(delivered[o.id]), pending: Math.max(0, n(o.total_qty) - n(delivered[o.id])), status: o.status }))

  const stockCols: Column<StockRow>[] = [
    { key: 'code', header: 'Material Code', accessor: r => r.code, sortable: true, className: 'font-medium' },
    { key: 'name', header: 'Product', accessor: r => r.name },
    { key: 'category', header: 'Category', accessor: r => r.category },
    { key: 'available', header: 'Available', className: 'text-right', accessor: r => `${formatNumber(r.available)}${r.uom ? ' ' + r.uom : ''}` }
  ]

  if (loading) return <TableSkeleton rows={8} cols={5} />
  const cards = [
    { icon: 'receipt_long', label: 'My Orders', value: kpi.total, tone: 'text-brand-600' },
    { icon: 'today', label: 'Today', value: kpi.todayCount, tone: 'text-brand-600' },
    { icon: 'request_quote', label: 'Invoiced', value: kpi.invoiced, tone: 'text-blue-600' },
    { icon: 'local_shipping', label: 'Delivered', value: kpi.delivered, tone: 'text-green-600' },
    { icon: 'pending_actions', label: 'Pending', value: kpi.pending, tone: 'text-amber-600' }
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">My Order Board</h1>
        <p className="text-sm text-ink-soft">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''} — your orders, progress and saleable stock.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(c => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft"><Icon name={c.icon} className={`text-[16px] ${c.tone}`} /> {c.label}</div>
            <p className="mt-2 font-display text-[24px] font-bold leading-none text-ink">{formatNumber(c.value)}</p>
          </Card>
        ))}
      </div>

      {/* Orders / Saleable Stock toggle */}
      <Segmented value={mode} onChange={setMode}
        options={[{ value: 'orders', label: 'My Orders' }, { value: 'stock', label: 'Saleable Stock' }]} />

      {mode === 'orders' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search my orders…" /></div>
            <span className="text-sm text-ink-soft">{rows.length} orders</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => downloadCSV('My Orders', exportCols, exportRows)} className="rounded-lg border border-surface-line px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-sunken">Excel (CSV)</button>
              <button onClick={() => downloadReportPDF('My Orders', 'My sales orders & progress', exportCols, exportRows)} className="rounded-lg border border-surface-line px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-sunken">PDF</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {rows.map(o => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{o.so_no}</p>
                    <p className="truncate text-sm text-ink-soft">{customers[o.customer_id ?? ''] ?? '—'}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">{formatDate(o.order_date)} · Qty {formatNumber(o.total_qty)} · Delivered {formatNumber(delivered[o.id])}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge status={o.status} />
                    <ActionMenu items={[{ icon: 'visibility', label: 'View progress', onClick: () => setView(o) }]} />
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-surface-sunken px-2 py-2"><Stepper status={o.status} /></div>
              </Card>
            ))}
            {rows.length === 0 && <Card className="p-6 text-center text-sm text-ink-faint">No orders yet — create one in Order.</Card>}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-72"><SearchBar value={sq} onChange={setSq} placeholder="Search product / category…" /></div>
            <span className="text-sm text-ink-soft">{stockRows.length} products in stock</span>
          </div>
          <Card className="overflow-hidden">
            <DataTable columns={stockCols} rows={stockRows} rowKey={r => r.code} emptyTitle="No saleable stock" />
          </Card>
          <p className="text-xs text-ink-faint">Available = good stock minus reserved. This is read-only.</p>
        </>
      )}

      {view && <OrderProgress order={view} customerName={customers[view.customer_id ?? ''] ?? '—'} delivered={n(delivered[view.id])} onClose={() => setView(null)} />}
    </div>
  )
}

type AuditEvent = Pick<Tables<'audit_logs'>, 'id' | 'action' | 'new_data' | 'changed_by' | 'changed_at'>

function OrderProgress({ order, customerName, delivered, onClose }: {
  order: SalesOrderRow; customerName: string; delivered: number; onClose: () => void
}) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([
      supabase.from('audit_logs').select('id,action,new_data,changed_by,changed_at').eq('table_name', 'sales_orders').eq('record_id', order.id).order('changed_at', { ascending: true }),
      supabase.from('profiles').select('id,full_name')
    ]).then(([a, p]) => {
      setEvents(a.data ?? [])
      const m: Record<string, string> = {}; (p.data ?? []).forEach(r => { m[r.id] = r.full_name || '—' })
      setNames(m); setLoading(false)
    })
  }, [order.id])

  return (
    <Modal open onClose={onClose} title={`Progress — ${order.so_no}`} size="md">
      <div className="space-y-4">
        <div className="rounded-lg bg-surface-sunken px-3 py-3"><Stepper status={order.status} /></div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-ink-faint">Customer: </span>{customerName}</div>
          <div><span className="text-ink-faint">Status: </span><StatusBadge status={order.status} /></div>
          <div><span className="text-ink-faint">Order Qty: </span>{formatNumber(order.total_qty)}</div>
          <div><span className="text-ink-faint">Delivered: </span>{formatNumber(delivered)}</div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Status History — who & when</p>
          {loading ? <p className="py-3 text-sm text-ink-faint">Loading…</p> : events.length === 0 ? <p className="py-3 text-sm text-ink-faint">No history recorded yet.</p> : (
            <div className="space-y-0">
              {events.map((e, i) => {
                const newData = e.new_data as Record<string, unknown> | null
                const status = newData?.status ? String(newData.status) : null
                const label = e.action === 'INSERT' ? 'Order created' : status ? `Status → ${status}` : 'Updated'
                return (
                  <div key={e.id} className="flex gap-3 pb-3">
                    <div className="flex flex-col items-center">
                      <span className={'flex h-7 w-7 items-center justify-center rounded-full ' + (e.action === 'INSERT' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                        <Icon name={e.action === 'INSERT' ? 'add' : 'edit'} className="text-[15px]" />
                      </span>
                      {i < events.length - 1 && <span className="my-1 w-px flex-1 bg-surface-line" />}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-ink">{label}</p>
                      <p className="text-[11px] text-ink-faint">{formatDateTime(e.changed_at)} · by {names[e.changed_by ?? ''] ?? '—'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-surface-line pt-3"><button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-sunken">Close</button></div>
      </div>
    </Modal>
  )
}
