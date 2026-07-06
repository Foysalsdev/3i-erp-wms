import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Available-to-promise, per product: what's physically on hand, split into
// WHY it isn't sellable right now — so Sales only ever quotes genuinely free
// stock (Total = Saleable + Held + Pending Invoice + Pending Delivery + the
// non-saleable condition pool). Purely a computed read: nothing here is a
// stored counter, so it can never drift out of sync with the sales orders
// and inventory_stock rows it derives from.
// ---------------------------------------------------------------------------

export interface StockAvailability {
  total: number           // everything on hand, any condition
  good: number            // 'good' (fresh/saleable-condition) on hand
  nonSaleable: number     // damaged/quarantine/replacement_return/box_damaged/parts_removed
  held: number            // manual hold on good stock (Inventory → Hold Stock)
  pendingInvoice: number  // committed to orders approved/picking/packed — not yet invoiced
  pendingDelivery: number // invoiced/dispatched — billed but not yet fully delivered
  saleable: number        // good - held - pendingInvoice - pendingDelivery, floored at 0
}

const empty = (): StockAvailability => ({ total: 0, good: 0, nonSaleable: 0, held: 0, pendingInvoice: 0, pendingDelivery: 0, saleable: 0 })

// Sales-order stages that keep stock off the saleable pool: approved through
// packed hold it against picking; invoiced/dispatched means it's billed and
// leaving but hasn't posted through Issue Challan (real deduction) yet.
const PENDING_INVOICE_STATUSES = ['approved', 'picking', 'packed']
const PENDING_DELIVERY_STATUSES = ['invoiced', 'dispatched']

// excludeSoId: when editing an existing order, that order's own lines
// shouldn't count against itself — otherwise the saleable figure shown while
// editing an order would be dominated by the very qty already on that order.
export async function fetchStockAvailability(clientId: string, excludeSoId?: string): Promise<Record<string, StockAvailability>> {
  const [{ data: stock }, { data: orders }] = await Promise.all([
    supabase.from('inventory_stock').select('product_id,quantity,reserved_qty,stock_status').eq('client_id', clientId),
    supabase.from('sales_orders').select('id,status').eq('client_id', clientId)
      .in('status', [...PENDING_INVOICE_STATUSES, ...PENDING_DELIVERY_STATUSES])
  ])

  const orderIds = (orders ?? []).map((o: any) => o.id).filter((id: string) => id !== excludeSoId)
  const statusOf = new Map((orders ?? []).map((o: any) => [o.id, o.status]))
  const { data: items } = orderIds.length
    ? await supabase.from('sales_order_items').select('so_id,product_id,qty,delivered_qty').in('so_id', orderIds)
    : { data: [] as any[] }

  const out: Record<string, StockAvailability> = {}
  const get = (id: string) => out[id] ?? (out[id] = empty())

  ;(stock ?? []).forEach((r: any) => {
    const a = get(r.product_id)
    const qty = Number(r.quantity) || 0
    a.total += qty
    if (r.stock_status === 'good') { a.good += qty; a.held += Number(r.reserved_qty) || 0 }
    else a.nonSaleable += qty
  })

  ;(items ?? []).forEach((it: any) => {
    if (!it.product_id) return
    const pending = Math.max(0, (Number(it.qty) || 0) - (Number(it.delivered_qty) || 0))
    if (pending <= 0) return
    const a = get(it.product_id)
    const status = statusOf.get(it.so_id)
    if (PENDING_INVOICE_STATUSES.includes(status)) a.pendingInvoice += pending
    else if (PENDING_DELIVERY_STATUSES.includes(status)) a.pendingDelivery += pending
  })

  Object.values(out).forEach(a => { a.saleable = Math.max(0, a.good - a.held - a.pendingInvoice - a.pendingDelivery) })
  return out
}
