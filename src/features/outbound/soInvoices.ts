import { supabase } from '@/lib/supabase'

// Shared loader for an order's invoice register (so_invoices + lines) with
// live delivery figures derived from its challans. Used by the Invoices modal,
// the order overview's Fulfilment panel and the challan form's invoice picker,
// so all three always agree on the numbers.
//
// Per invoice line:
//   qty       — invoiced quantity
//   delivered — on challans already issued (stock posted)
//   planned   — on open (draft) challans not yet issued
// remaining to plan = qty - delivered - planned.
export interface SoInvoiceLine {
  id: string; invoice_id: string; so_item_id: string; product_id: string
  qty: number; delivered: number; planned: number
}
export interface SoInvoice {
  id: string; invoice_no: string; invoice_date: string
  lines: SoInvoiceLine[]; qty: number; delivered: number; challans: any[]
  [k: string]: any
}

export async function loadSoInvoices(soId: string): Promise<{ items: any[]; invoices: SoInvoice[]; challans: any[] }> {
  const [{ data: items }, { data: invs }, { data: chs }] = await Promise.all([
    supabase.from('sales_order_items').select('*').eq('so_id', soId),
    (supabase as any).from('so_invoices').select('*').eq('so_id', soId).order('created_at'),
    supabase.from('delivery_challans').select('id,challan_no,invoice_id,posted_at,status').eq('sales_order_id', soId).neq('status', 'cancelled')
  ])
  const invIds = (invs ?? []).map((i: any) => i.id)
  const { data: invItems } = invIds.length
    ? await (supabase as any).from('so_invoice_items').select('*').in('invoice_id', invIds)
    : { data: [] as any[] }
  const chIds = (chs ?? []).map((c: any) => c.id)
  const { data: chItems } = chIds.length
    ? await supabase.from('delivery_challan_items').select('challan_id,so_item_id,qty').in('challan_id', chIds)
    : { data: [] as any[] }
  const chById = new Map((chs ?? []).map((c: any) => [c.id, c]))
  const deliveredBy: Record<string, number> = {}, plannedBy: Record<string, number> = {}
  ;(chItems ?? []).forEach((ci: any) => {
    const ch: any = chById.get(ci.challan_id)
    if (!ch?.invoice_id || !ci.so_item_id) return
    const k = ch.invoice_id + ':' + ci.so_item_id
    if (ch.posted_at) deliveredBy[k] = (deliveredBy[k] || 0) + Number(ci.qty || 0)
    else plannedBy[k] = (plannedBy[k] || 0) + Number(ci.qty || 0)
  })
  const invoices: SoInvoice[] = (invs ?? []).map((inv: any) => {
    const lines = (invItems ?? []).filter((it: any) => it.invoice_id === inv.id).map((it: any) => ({
      ...it,
      qty: Number(it.qty || 0),
      delivered: deliveredBy[inv.id + ':' + it.so_item_id] || 0,
      planned: plannedBy[inv.id + ':' + it.so_item_id] || 0
    }))
    const qty = lines.reduce((s: number, l: any) => s + l.qty, 0)
    const delivered = lines.reduce((s: number, l: any) => s + l.delivered, 0)
    const challans = (chs ?? []).filter((c: any) => c.invoice_id === inv.id)
    return { ...inv, lines, qty, delivered, challans }
  })
  return { items: items ?? [], invoices, challans: chs ?? [] }
}

export const invoiceDeliveryTone = (inv: { qty: number; delivered: number }) =>
  inv.delivered >= inv.qty && inv.qty > 0 ? 'positive' as const : inv.delivered > 0 ? 'info' as const : 'neutral' as const
export const invoiceDeliveryLabel = (inv: { qty: number; delivered: number }) =>
  inv.delivered >= inv.qty && inv.qty > 0 ? 'Delivered' : inv.delivered > 0 ? 'Partially Delivered' : 'Pending Delivery'
