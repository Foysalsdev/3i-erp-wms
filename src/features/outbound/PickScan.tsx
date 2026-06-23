import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatNumber } from '@/lib/utils'

const num = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

interface PLine {
  item_id: string; product_id: string; code: string; name: string; uom: string
  ordered: number; delivered: number; pending: number; saleable: number; pick: string
}

// Pick & Scan for a single sales order (opened from the order, not a tab).
// Shows ordered / delivered / pending and live saleable stock per line; enter
// (or scan) a pick qty and create a delivery challan for that batch. Partial
// fulfilment is fine — the rest stays pending for a later challan.
export function PickScan({ lockSoId, onDone }: { lockSoId: string; onDone?: () => void }) {
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  const [soRow, setSoRow] = useState<any>(null)
  const [lines, setLines] = useState<PLine[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (currentClientId && lockSoId) load() /* eslint-disable-next-line */ }, [currentClientId, lockSoId])

  const load = async () => {
    setLoading(true)
    try {
      const { data: order } = await supabase.from('sales_orders').select('id,so_no,customer_id,warehouse_id,status,reference_no').eq('id', lockSoId).single()
      setSoRow(order)
      const { data: items } = await supabase.from('sales_order_items').select('id,product_id,qty,delivered_qty').eq('so_id', lockSoId)
      const pids = (items ?? []).map((i: any) => i.product_id).filter(Boolean)
      const guard = pids.length ? pids : ['00000000-0000-0000-0000-000000000000']
      const [{ data: prods }, { data: stock }] = await Promise.all([
        supabase.from('products').select('id,material_code,name,uom').in('id', guard),
        supabase.from('inventory_stock').select('product_id,quantity,reserved_qty,warehouse_id').eq('client_id', currentClientId!).eq('stock_status', 'good').in('product_id', guard)
      ])
      const pmap: Record<string, any> = {}; (prods ?? []).forEach((p: any) => { pmap[p.id] = p })
      const saleable = (pid: string) => (stock ?? []).filter((s: any) => s.product_id === pid && (!order?.warehouse_id || s.warehouse_id === order.warehouse_id))
        .reduce((a: number, s: any) => a + (num(s.quantity) - num(s.reserved_qty)), 0)
      setLines((items ?? []).map((it: any) => {
        const ordered = num(it.qty), delivered = num(it.delivered_qty), pending = Math.max(0, ordered - delivered)
        const p = pmap[it.product_id] ?? {}
        return { item_id: it.id, product_id: it.product_id, code: p.material_code ?? '?', name: p.name ?? 'Unknown', uom: p.uom ?? '', ordered, delivered, pending, saleable: saleable(it.product_id), pick: '' }
      }))
    } finally { setLoading(false) }
  }

  const setPick = (i: number, v: string) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, pick: v } : l))
  const fillPending = () => setLines(ls => ls.map(l => ({ ...l, pick: String(Math.min(l.pending, l.saleable)) })))
  const totalPick = lines.reduce((s, l) => s + num(l.pick), 0)

  const createChallan = async () => {
    if (!soRow) return
    const picks = lines.filter(l => num(l.pick) > 0)
    if (picks.length === 0) { notify('error', 'Onto ekta line-e pick qty din'); return }
    const over = picks.find(l => num(l.pick) > l.pending)
    if (over) { notify('error', `${over.code}: pick qty pending (${over.pending}) er beshi hote parbe na`); return }
    setBusy(true)
    try {
      const challan_no = await nextDocNumber(currentClientId!, 'DC')
      if (!challan_no) throw new Error('Could not generate challan number')
      const { data: ch, error } = await supabase.from('delivery_challans').insert({
        client_id: currentClientId!, challan_no, sales_order_id: soRow.id, customer_id: soRow.customer_id,
        warehouse_id: soRow.warehouse_id, po_no: soRow.reference_no || null,
        challan_date: new Date().toISOString().slice(0, 10), total_qty: totalPick, status: 'draft'
      }).select('id').single()
      if (error) throw error
      const rows = picks.map(l => ({ client_id: currentClientId!, challan_id: ch.id, product_id: l.product_id, so_item_id: l.item_id, qty: num(l.pick), unit_price: 0, stock_status: 'good' }))
      const { error: ie } = await supabase.from('delivery_challan_items').insert(rows)
      if (ie) throw ie
      await supabase.from('sales_orders').update({ status: 'picking' }).eq('id', soRow.id).eq('status', 'pending')
      notify('success', `Challan ${challan_no} draft toiri — Delivery Challan tab e Invoice diye Issue korun`)
      onDone?.(); load()
    } catch (e: any) { notify('error', e?.message ?? 'Could not create challan') } finally { setBusy(false) }
  }

  const tone = (l: PLine) => l.saleable < l.pending ? 'critical' : 'positive'
  if (loading) return <p className="py-6 text-center text-sm text-ink-faint">Loading…</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">print order for scan</button>
        <button type="button" onClick={fillPending} className="text-xs font-medium text-brand-600 hover:underline">Fill pending</button>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-sunken text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2 text-left font-semibold">Material</th>
                <th className="px-3 py-2 text-right font-semibold">Ordered</th>
                <th className="px-3 py-2 text-right font-semibold">Delivered</th>
                <th className="px-3 py-2 text-right font-semibold">Pending</th>
                <th className="px-3 py-2 text-right font-semibold">Saleable stock</th>
                <th className="px-3 py-2 text-right font-semibold">Pick / scan</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.item_id} className="border-t border-surface-line">
                  <td className="px-3 py-2"><div className="font-mono text-xs text-ink">{l.code}</div><div className="truncate text-xs text-ink-soft">{l.name}{l.uom ? ' · ' + l.uom : ''}</div></td>
                  <td className="px-3 py-2 text-right">{formatNumber(l.ordered)}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">{formatNumber(l.delivered)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatNumber(l.pending)}</td>
                  <td className="px-3 py-2 text-right"><Badge tone={tone(l)}>{formatNumber(l.saleable)}</Badge></td>
                  <td className="px-3 py-2 text-right"><input type="number" step="any" value={l.pick} disabled={l.pending <= 0} onChange={e => setPick(i, e.target.value)} className="fiori-input h-8 w-24 text-right disabled:opacity-40" placeholder="0" /></td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-faint">No lines on this order</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-surface-line bg-surface-sunken px-4 py-3">
          <span className="text-sm text-ink-soft">Picking <span className="font-semibold text-ink">{formatNumber(totalPick)}</span></span>
          {canEdit && <Button icon="local_shipping" loading={busy} onClick={createChallan} disabled={totalPick <= 0}>Create Delivery Challan</Button>}
        </div>
      </Card>
      <p className="text-xs text-ink-faint">Saleable stock = good available qty. Create a challan for whatever you ship now; the rest stays pending for a later challan.</p>
    </div>
  )
}
