import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import SalesmanBoard from './SalesmanBoard'
import { Card, CardHeader } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/States'
import { formatNumber, formatDateTime, cn } from '@/lib/utils'
import { OPERATIONS } from '@/features/operations/registry'
import { PendingMattersPanel } from '@/components/shared/PendingMattersPanel'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts'

const COLORS = ['#16a34a', '#dc2626', '#ea7a0c']
const AGING_COLORS = ['#16a34a', '#eeb111', '#ea7a0c', '#dc2626', '#8c8f94']
const BUCKETS = ['0–30', '31–60', '61–90', '90+', 'Unknown']

const keyOf = (p: string, w: string, l: string | null) => `${p}|${w}|${l ?? ''}`
const daysSince = (iso?: string | null) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null
const bucketOf = (age: number | null) => age === null ? 'Unknown' : age <= 30 ? '0–30' : age <= 60 ? '31–60' : age <= 90 ? '61–90' : '90+'

function Kpi({ icon, label, value, hint, hintTone = 'muted' }:
  { icon: string; label: string; value: string; hint?: string; hintTone?: 'muted' | 'ok' | 'warn' }) {
  const tone = hintTone === 'ok' ? 'text-ok' : hintTone === 'warn' ? 'text-warn' : 'text-ink-faint'
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
        <Icon name={icon} className="text-[16px] text-brand-600" /> {label}
      </div>
      <p className="mt-2.5 font-display text-[26px] font-bold leading-none text-ink">{value}</p>
      {hint && <p className={`mt-2 text-[11px] ${tone}`}>{hint}</p>}
    </Card>
  )
}

// Dashboard sections, drag-reorderable — order persisted per browser.
type WidgetId = 'overview' | 'charts' | 'movements'
const DEFAULT_ORDER: WidgetId[] = ['overview', 'charts', 'movements']
const ORDER_KEY = '3i_dashboard_order'
function loadWidgetOrder(): WidgetId[] {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? 'null')
    return Array.isArray(saved) && saved.length === DEFAULT_ORDER.length && DEFAULT_ORDER.every(w => saved.includes(w)) ? saved : DEFAULT_ORDER
  } catch {
    return DEFAULT_ORDER
  }
}

// Drag-and-drop reorder via native HTML5 DnD — no library needed for three blocks.
function DraggableSection({ id, label, dragging, onDragStart, onDrop, children }: {
  id: WidgetId; label: string; dragging: WidgetId | null
  onDragStart: (id: WidgetId) => void; onDrop: (id: WidgetId) => void; children: React.ReactNode
}) {
  return (
    <div onDragOver={e => e.preventDefault()} onDrop={() => onDrop(id)}
      className={cn('rounded-2xl transition-opacity', dragging === id && 'opacity-40')}>
      <div draggable onDragStart={() => onDragStart(id)}
        className="mb-2 flex w-fit cursor-grab items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint active:cursor-grabbing">
        <Icon name="drag_indicator" className="text-[16px]" /> {label}
      </div>
      {children}
    </div>
  )
}

// Compact operational tile linking through to the relevant module register.
function OpTile({ icon, label, value, to, alert }:
  { icon: string; label: string; value: number; to: string; alert?: boolean }) {
  return (
    <Link to={to}
      className="group flex items-center justify-between rounded-card border border-surface-line bg-surface p-4 transition hover:border-brand-200 hover:shadow-card">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${alert ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-surface-sunken text-ink-soft'}`}>
          <Icon name={icon} className="text-[18px]" />
        </span>
        <span className="text-sm font-medium text-ink-soft">{label}</span>
      </div>
      <span className={`font-display text-xl font-bold ${alert ? 'text-amber-600' : 'text-ink'}`}>{formatNumber(value)}</span>
    </Link>
  )
}

function AdminDashboard() {
  const { currentClientId, clients, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState({ skus: 0, onHand: 0, lowStock: 0, warehouses: 0 })
  const [byStatus, setByStatus] = useState<{ name: string; value: number }[]>([])
  const [trend, setTrend] = useState<{ label: string; in: number; out: number }[]>([])
  const [aging, setAging] = useState<{ bucket: string; qty: number }[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [ops, setOps] = useState<Record<string, number>>({})
  const [util, setUtil] = useState<{ used: number; capacity: number } | null>(null)
  const client = clients.find(c => c.id === currentClientId)
  const [order, setOrder] = useState<WidgetId[]>(loadWidgetOrder)
  const [dragging, setDragging] = useState<WidgetId | null>(null)
  const dropOn = (target: WidgetId) => {
    if (!dragging || dragging === target) return
    const next = [...order]
    next.splice(next.indexOf(dragging), 1)
    next.splice(next.indexOf(target), 0, dragging)
    setOrder(next)
    localStorage.setItem(ORDER_KEY, JSON.stringify(next))
    setDragging(null)
  }

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    ;(async () => {
      const since14 = new Date(); since14.setDate(since14.getDate() - 13); since14.setHours(0, 0, 0, 0)
      const [{ count: skus }, { count: warehouses }, { data: stock }, { data: products }, { data: recentLedger }, { data: trendLedger }, { data: firstIn }] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('client_id', currentClientId),
        supabase.from('warehouses').select('id', { count: 'exact', head: true }).eq('client_id', currentClientId),
        supabase.from('inventory_stock').select('product_id, warehouse_id, location_id, quantity, stock_status').eq('client_id', currentClientId),
        supabase.from('products').select('id, name, restock_level').eq('client_id', currentClientId),
        supabase.from('inventory_ledger').select('movement_type, qty_in, qty_out, created_at, reference_no').eq('client_id', currentClientId).order('created_at', { ascending: false }).limit(8),
        // Last 14 days of movement, for the inbound-vs-outbound trend.
        supabase.from('inventory_ledger').select('qty_in, qty_out, created_at').eq('client_id', currentClientId).gte('created_at', since14.toISOString()),
        // Earliest inbound per product/warehouse/location, to age today's on-hand stock.
        supabase.from('inventory_ledger').select('product_id, warehouse_id, location_id, created_at').eq('client_id', currentClientId).gt('qty_in', 0).order('created_at', { ascending: true }).limit(5000)
      ])
      const statusAgg: Record<string, number> = { good: 0, damaged: 0, quarantine: 0 }
      const perProduct: Record<string, number> = {}
      let onHand = 0
      ;(stock ?? []).forEach(s => {
        statusAgg[s.stock_status] = (statusAgg[s.stock_status] ?? 0) + Number(s.quantity)
        onHand += Number(s.quantity); perProduct[s.product_id] = (perProduct[s.product_id] ?? 0) + Number(s.quantity)
      })
      const lowStock = (products ?? []).filter(p => (perProduct[p.id] ?? 0) <= Number(p.restock_level)).length
      setKpi({ skus: skus ?? 0, onHand, lowStock, warehouses: warehouses ?? 0 })
      setByStatus([{ name: 'Good', value: statusAgg.good }, { name: 'Damaged', value: statusAgg.damaged }, { name: 'Quarantine', value: statusAgg.quarantine }])
      setRecent(recentLedger ?? [])

      // 14-day trend, filled so gap days show as zero rather than skipping.
      const days: { date: string; label: string; in: number; out: number }[] = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        days.push({ date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), in: 0, out: 0 })
      }
      const byDate = Object.fromEntries(days.map(d => [d.date, d]))
      ;(trendLedger ?? []).forEach((r: any) => {
        const row = byDate[String(r.created_at).slice(0, 10)]
        if (row) { row.in += Number(r.qty_in || 0); row.out += Number(r.qty_out || 0) }
      })
      setTrend(days)

      // Stock aging: bucket on-hand qty by days since its earliest recorded inbound.
      const earliest: Record<string, string> = {}
      ;(firstIn ?? []).forEach((m: any) => {
        const k = keyOf(m.product_id, m.warehouse_id, m.location_id)
        if (!earliest[k]) earliest[k] = m.created_at
      })
      const bucketTotals: Record<string, number> = {}
      ;(stock ?? []).forEach((s: any) => {
        if (Number(s.quantity) <= 0) return
        const age = daysSince(earliest[keyOf(s.product_id, s.warehouse_id, s.location_id)] ?? null)
        const b = bucketOf(age)
        bucketTotals[b] = (bucketTotals[b] ?? 0) + Number(s.quantity)
      })
      setAging(BUCKETS.map(b => ({ bucket: b, qty: bucketTotals[b] ?? 0 })).filter(x => x.qty > 0))
      setLoading(false)
    })()
  }, [currentClientId])

  // Open/pending counts per operational module + warehouse utilization.
  useEffect(() => {
    if (!currentClientId) return
    ;(async () => {
      const entries = await Promise.all(Object.values(OPERATIONS).map(async def => {
        const { count } = await supabase.from(def.table as any)
          .select('id', { count: 'exact', head: true })
          .eq('client_id', currentClientId)
          .in('status', def.openStatuses)
        return [def.key, count ?? 0] as const
      }))
      setOps(Object.fromEntries(entries))
      const [{ data: locs }, { data: stock }] = await Promise.all([
        supabase.from('locations').select('capacity').eq('client_id', currentClientId),
        supabase.from('inventory_stock').select('quantity').eq('client_id', currentClientId)
      ])
      const capacity = (locs ?? []).reduce((s, l: any) => s + Number(l.capacity ?? 0), 0)
      const used = (stock ?? []).reduce((s, r: any) => s + Number(r.quantity ?? 0), 0)
      setUtil({ used, capacity })
    })()
  }, [currentClientId])

  if (loading) return <Spinner label="Loading dashboard…" />
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = (profile?.full_name || 'there').split(' ')[0]

  const sections: Record<WidgetId, React.ReactNode> = {
    overview: (
      <div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon="stacks" label="Total Stock" value={formatNumber(kpi.onHand)} hint={`${kpi.skus} active SKUs`} />
          <Kpi icon="donut_large" label="Warehouse Utilization"
            value={util && util.capacity > 0 ? `${Math.round((util.used / util.capacity) * 100)}%` : '—'}
            hint={util && util.capacity > 0 ? `${formatNumber(util.used)} / ${formatNumber(util.capacity)} capacity` : 'set location capacity'}
            hintTone={util && util.capacity > 0 && util.used / util.capacity > 0.9 ? 'warn' : 'muted'} />
          <Kpi icon="warning" label="Low-stock items" value={formatNumber(kpi.lowStock)} hint={kpi.lowStock ? 'needs reorder' : 'all above level'} hintTone={kpi.lowStock ? 'warn' : 'ok'} />
          <Kpi icon="home_work" label="Warehouses" value={formatNumber(kpi.warehouses)} hint="operational" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OpTile icon="inventory" label="Pending GRN" value={ops.grn ?? 0} to="/inbound/grn" alert={(ops.grn ?? 0) > 0} />
          <OpTile icon="move_to_inbox" label="Pending Putaway" value={ops.putaway ?? 0} to="/inbound/putaway" alert={(ops.putaway ?? 0) > 0} />
          <OpTile icon="shopping_cart_checkout" label="Pending Picking" value={ops.picking ?? 0} to="/outbound/picking" alert={(ops.picking ?? 0) > 0} />
          <OpTile icon="local_shipping" label="Pending Dispatch" value={ops.dispatch ?? 0} to="/outbound/dispatch" alert={(ops.dispatch ?? 0) > 0} />
          <OpTile icon="assignment" label="Open Transport Requests" value={ops['transport-request'] ?? 0} to="/transport/transport-request" alert={(ops['transport-request'] ?? 0) > 0} />
        </div>
      </div>
    ),
    charts: (
      <div className="space-y-4">
        <Card>
          <CardHeader title="Inbound vs Outbound" subtitle="Last 14 days, from the stock ledger" />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.16)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.14)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="in" name="Inbound" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="out" name="Outbound" stroke="#ea7a0c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Stock Aging" subtitle="On-hand qty by days since first receipt" />
            <div className="h-64 p-4">
              {aging.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aging} margin={{ left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.16)" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                    <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.14)' }} />
                    <Bar dataKey="qty" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {aging.map((_, i) => <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="grid h-full place-items-center text-sm text-ink-soft">No stock data yet</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Stock by Condition" />
            <div className="h-64 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={2} cornerRadius={4}>
                    {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.14)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-xs text-ink-soft">
                {byStatus.map((s, i) => <span key={s.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />{s.name}</span>)}
              </div>
            </div>
          </Card>
        </div>
      </div>
    ),
    movements: (
      <Card>
        <CardHeader title="Recent stock movements" subtitle="Latest ledger activity" />
        <div className="divide-y divide-surface-line">
          {recent.length ? recent.map((m, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${m.qty_in > 0 ? 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400'}`}>
                  <Icon name={m.qty_in > 0 ? 'south_west' : 'north_east'} className="text-[16px]" />
                </span>
                <span className="font-semibold text-ink">{m.movement_type}</span>
                {m.reference_no && <span className="text-ink-faint">· {m.reference_no}</span>}
              </span>
              <span className="text-ink-soft">{m.qty_in > 0 ? `+${formatNumber(m.qty_in)}` : `-${formatNumber(m.qty_out)}`} · {formatDateTime(m.created_at)}</span>
            </div>
          )) : <p className="px-5 py-6 text-center text-sm text-ink-soft">No movements recorded yet</p>}
        </div>
      </Card>
    )
  }
  const labels: Record<WidgetId, string> = { overview: 'Overview', charts: 'Analytics', movements: 'Activity' }

  return (
    <div className="space-y-6">
      {/* Clean header (no gold hero) */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-surface-line pb-5">
        <div>
          <p className="text-xs font-medium text-ink-faint">{greet}, {firstName}</p>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">{client?.name} · Operations overview</h1>
          <p className="mt-0.5 text-sm text-ink-soft">Live inventory, stock health and recent movements.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-surface-line bg-surface px-3 py-2 text-sm text-ink-soft">
          <Icon name="calendar_today" className="text-[17px] text-ink-faint" />
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* Every pending matter the user owns — rule-driven (lib/pending.ts). */}
      <PendingMattersPanel />

      {order.map(id => (
        <DraggableSection key={id} id={id} label={labels[id]} dragging={dragging} onDragStart={setDragging} onDrop={dropOn}>
          {sections[id]}
        </DraggableSection>
      ))}
    </div>
  )
}

// Sales-only users (outbound access, no inventory access, not admin) get their
// own Order Board; everyone else gets the dashboard above.
export default function DashboardPage() {
  const salesOnly = useAuth(s => !s.isPlatformAdmin && s.permissions.has('outbound.view') && !s.permissions.has('inventory.view'))
  return salesOnly ? <SalesmanBoard /> : <AdminDashboard />
}
