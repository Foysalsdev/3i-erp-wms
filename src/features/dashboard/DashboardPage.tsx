import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import SalesmanBoard from './SalesmanBoard'
import { Card, CardHeader } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { formatNumber, formatDateTime } from '@/lib/utils'
import { MODULES } from '@/lib/constants'
import { OPERATIONS } from '@/features/operations/registry'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts'

const COLORS = ['#16a34a', '#dc2626', '#ea7a0c']

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

// Compact operational tile linking through to the relevant module register.
function OpTile({ icon, label, value, to, alert }:
  { icon: string; label: string; value: number; to: string; alert?: boolean }) {
  return (
    <Link to={to}
      className="group flex items-center justify-between rounded-card border border-surface-line bg-surface p-4 transition hover:border-brand-200 hover:shadow-card">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${alert ? 'bg-amber-50 text-amber-600' : 'bg-surface-sunken text-ink-soft'}`}>
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
  const { tab } = useParams()
  const nav = useNavigate()
  const dashTabs = MODULES.find(m => m.key === 'dashboard')!.tabs!
  const active = tab && dashTabs.some(t => t.key === tab) ? tab : 'executive'
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState({ skus: 0, onHand: 0, lowStock: 0, warehouses: 0 })
  const [byStatus, setByStatus] = useState<{ name: string; value: number }[]>([])
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [ops, setOps] = useState<Record<string, number>>({})
  const [util, setUtil] = useState<{ used: number; capacity: number } | null>(null)
  const client = clients.find(c => c.id === currentClientId)

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    ;(async () => {
      const [{ count: skus }, { count: warehouses }, { data: stock }, { data: products }, { data: ledger }] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('client_id', currentClientId),
        supabase.from('warehouses').select('id', { count: 'exact', head: true }).eq('client_id', currentClientId),
        supabase.from('inventory_stock').select('product_id, quantity, stock_status').eq('client_id', currentClientId),
        supabase.from('products').select('id, name, restock_level').eq('client_id', currentClientId),
        supabase.from('inventory_ledger').select('movement_type, qty_in, qty_out, created_at, reference_no').eq('client_id', currentClientId).order('created_at', { ascending: false }).limit(8)
      ])
      const statusAgg: Record<string, number> = { good: 0, damaged: 0, quarantine: 0 }
      const perProduct: Record<string, number> = {}
      let onHand = 0
      ;(stock ?? []).forEach(s => {
        statusAgg[s.stock_status] = (statusAgg[s.stock_status] ?? 0) + Number(s.quantity)
        onHand += Number(s.quantity); perProduct[s.product_id] = (perProduct[s.product_id] ?? 0) + Number(s.quantity)
      })
      const nameById = Object.fromEntries((products ?? []).map(p => [p.id, p.name]))
      const lowStock = (products ?? []).filter(p => (perProduct[p.id] ?? 0) <= Number(p.restock_level)).length
      setKpi({ skus: skus ?? 0, onHand, lowStock, warehouses: warehouses ?? 0 })
      setByStatus([{ name: 'Good', value: statusAgg.good }, { name: 'Damaged', value: statusAgg.damaged }, { name: 'Quarantine', value: statusAgg.quarantine }])
      setTopProducts(Object.entries(perProduct).map(([id, qty]) => ({ name: nameById[id] ?? id, qty })).sort((a, b) => b.qty - a.qty).slice(0, 6))
      setRecent(ledger ?? [])
      setLoading(false)
    })()
  }, [currentClientId])

  // Executive overview: open/pending counts per operational module + warehouse utilization.
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

      <Tabs tabs={dashTabs} active={active} onChange={k => nav(`/dashboard/${k}`)} />

      {active === 'operational' && <OperationalDashboard ops={ops} />}

      {active === 'executive' && <>
      {/* Executive overview — live stock, utilisation and pending workload */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Executive overview</h2>
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
          <OpTile icon="receipt_long" label="Pending Billing" value={ops['customer-billing'] ?? 0} to="/finance/customer-billing" alert={(ops['customer-billing'] ?? 0) > 0} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Top products by on-hand quantity" />
          <div className="h-72 p-4">
            {topProducts.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} margin={{ left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.16)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                  <Tooltip cursor={{ fill: 'rgba(242,169,0,0.07)' }} contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.14)' }} />
                  <Bar dataKey="qty" fill="#f2a900" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="grid h-full place-items-center text-sm text-ink-soft">No stock data yet</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Stock by condition" />
          <div className="h-72 p-4">
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

      <Card>
        <CardHeader title="Recent stock movements" subtitle="Latest ledger activity" />
        <div className="divide-y divide-surface-line">
          {recent.length ? recent.map((m, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${m.qty_in > 0 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
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
      </>}
    </div>
  )
}

// Operational dashboard — live inbound/outbound workload plus status views
// for trip, courier and cycle-count flows (scaffolded until those modules land).
function OperationalDashboard({ ops }: { ops: Record<string, number> }) {
  const inbound = (ops.grn ?? 0) + (ops.putaway ?? 0)
  const outbound = (ops.picking ?? 0) + (ops.dispatch ?? 0)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Inbound Activities" subtitle="Open goods receipts & putaway tasks" />
          <div className="grid grid-cols-2 gap-3 p-4">
            <OpTile icon="inventory" label="Pending GRN" value={ops.grn ?? 0} to="/inbound/grn" alert={(ops.grn ?? 0) > 0} />
            <OpTile icon="move_to_inbox" label="Pending Putaway" value={ops.putaway ?? 0} to="/inbound/putaway" alert={(ops.putaway ?? 0) > 0} />
          </div>
          <p className="px-5 pb-4 text-xs text-ink-faint">{formatNumber(inbound)} open inbound task(s)</p>
        </Card>
        <Card>
          <CardHeader title="Outbound Activities" subtitle="Open picking & dispatch workload" />
          <div className="grid grid-cols-2 gap-3 p-4">
            <OpTile icon="shopping_cart_checkout" label="Pending Picking" value={ops.picking ?? 0} to="/outbound/picking" alert={(ops.picking ?? 0) > 0} />
            <OpTile icon="local_shipping" label="Pending Dispatch" value={ops.dispatch ?? 0} to="/outbound/dispatch" alert={(ops.dispatch ?? 0) > 0} />
          </div>
          <p className="px-5 pb-4 text-xs text-ink-faint">{formatNumber(outbound)} open outbound task(s)</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: 'route', label: 'Trip Status', hint: 'Trip Management module' },
          { icon: 'local_post_office', label: 'Courier Status', hint: 'Courier Management module' },
          { icon: 'fact_check', label: 'Cycle Count Status', hint: 'Cycle Count module' }
        ].map(s => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <Icon name={s.icon} className="text-[16px] text-brand-600" /> {s.label}
            </div>
            <p className="mt-2.5 font-display text-[22px] font-bold leading-none text-ink-faint">—</p>
            <p className="mt-2 text-[11px] text-ink-faint">Activates with the {s.hint}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Sales-only users (outbound access, no inventory access, not admin) get their
// own Order Board; everyone else gets the executive/operational dashboard.
export default function DashboardPage() {
  const salesOnly = useAuth(s => !s.isPlatformAdmin && s.permissions.has('outbound.view') && !s.permissions.has('inventory.view'))
  return salesOnly ? <SalesmanBoard /> : <AdminDashboard />
}
