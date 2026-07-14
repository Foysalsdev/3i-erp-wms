import { supabase } from '@/lib/supabase'

// Serial numbers are keyed by the product's Material Code prefix (e.g. 25001…).
// Units often arrive labelled with a factory prefix instead — the China Code
// (shared manufacturing code) or the barcode value from the product master.
// When a scanned serial starts with one of those, swap the prefix for the
// Material Code so every product keeps a single serial scheme.
export interface ProductCodes { material_code?: string | null; china_code?: string | null; barcode?: string | null }

// Validate + normalise one scanned serial against a product's codes. `matched`
// tells the caller whether the serial actually belongs to this product, so a
// mis-scan can be rejected ("wrong item") instead of silently accepted:
//   1. Material Code — the serial's leading code (first 5 digits by default);
//      the primary rule, always checked.
//   2. China Code / barcode — a factory prefix the unit may be labelled with;
//      when the serial starts with it, swap it for the Material Code so one
//      product keeps a single serial scheme.
//   3. Neither → matched:false (wrong item for this product).
// Pure string work — no I/O — so it stays instant under a rapid-fire scanner.
export function normaliseSerial(raw: string, p: ProductCodes): { serial: string; original?: string; matched: boolean } {
  const s = raw.trim()
  const up = (x: string) => x.trim().toUpperCase()
  const code = String(p.material_code ?? '').trim()
  if (!s) return { serial: s, matched: false }
  // No Material Code on the master → nothing to validate against; accept as-is.
  if (!code) return { serial: s, matched: true }
  if (up(s).startsWith(up(code))) return { serial: s, matched: true }
  for (const alt of [p.china_code, p.barcode]) {
    const a = String(alt ?? '').trim()
    if (a && up(s).startsWith(up(a))) return { serial: code + s.slice(a.length), original: s, matched: true }
  }
  return { serial: s, matched: false }
}

// ---------------------------------------------------------------------------
// A serial seen on an earlier transaction is allowed to be scanned again (a
// returned/replaced unit legitimately goes out twice) — the user just gets a
// small popup telling them where it was last: which document, which party,
// what date. This resolves those details for the popup.
// ---------------------------------------------------------------------------
export interface SerialHistoryItem {
  serial_no: string; reference_no: string | null; status: string
  date?: string | null; party?: string | null
}

export async function describeSerialHistory(clientId: string,
  rows: { serial_no: string; reference_no?: string | null; status?: string }[]): Promise<SerialHistoryItem[]> {
  const refs = [...new Set(rows.map(r => r.reference_no).filter(Boolean))] as string[]
  const base = rows.map(r => ({ serial_no: r.serial_no, reference_no: r.reference_no ?? null, status: r.status ?? '' }))
  if (!refs.length) return base
  // The reference may be a sales order, a delivery challan or a GRN number.
  const [so, dc, grn] = await Promise.all([
    supabase.from('sales_orders').select('so_no,order_date,customer_id').in('so_no', refs),
    supabase.from('delivery_challans').select('challan_no,challan_date,customer_id').in('challan_no', refs),
    supabase.from('goods_receipts').select('grn_no,receipt_date,supplier_id').in('grn_no', refs)
  ])
  const custIds = [...new Set([...(so.data ?? []).map(x => x.customer_id), ...(dc.data ?? []).map(x => x.customer_id)].filter(Boolean))] as string[]
  const suppIds = [...new Set((grn.data ?? []).map(x => x.supplier_id).filter(Boolean))] as string[]
  const [cust, supp] = await Promise.all([
    custIds.length ? supabase.from('customers').select('id,name').in('id', custIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    suppIds.length ? supabase.from('suppliers').select('id,name').in('id', suppIds) : Promise.resolve({ data: [] as { id: string; name: string }[] })
  ])
  const cmap = Object.fromEntries((cust.data ?? []).map(c => [c.id, c.name]))
  const smap = Object.fromEntries((supp.data ?? []).map(s => [s.id, s.name]))
  const refMap: Record<string, { date?: string; party?: string }> = {}
  ;(so.data ?? []).forEach(x => { refMap[x.so_no] = { date: x.order_date, party: cmap[x.customer_id ?? ''] } })
  ;(dc.data ?? []).forEach(x => { refMap[x.challan_no] = { date: x.challan_date, party: cmap[x.customer_id ?? ''] } })
  ;(grn.data ?? []).forEach(x => { refMap[x.grn_no] = { date: x.receipt_date, party: smap[x.supplier_id ?? ''] } })
  return base.map(r => ({ ...r, ...(r.reference_no ? refMap[r.reference_no] : {}) }))
}
