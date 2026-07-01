import { supabase } from '@/lib/supabase'

// Shared by the Delivery Challan list's "Print challan" action and the Sales
// Order Overview's per-delivery download button, so both produce the exact
// same PDF from the same mapping logic.
export async function downloadChallanPdfFor(challan: any, { customers, vehicles, products }: { customers: any[]; vehicles: any[]; products: any[] }) {
  const { data: items } = await supabase.from('delivery_challan_items').select('*').eq('challan_id', challan.id)
  const pmap: Record<string, any> = {}; products.forEach((p: any) => { pmap[p.id] = p })
  const cust = customers.find((x: any) => x.id === challan.customer_id)
  const veh = vehicles.find((x: any) => x.id === challan.vehicle_id)
  const { downloadChallanPDF } = await import('@/pdf/DeliveryChallanPDF')
  await downloadChallanPDF({
    challan,
    customerName: cust ? `${cust.customer_code} - ${cust.name}` : '',
    vehicleNo: veh?.vehicle_number || '',
    items: (items ?? []).map((it: any, i: number) => {
      const p = pmap[it.product_id] || {}
      return { sl: i + 1, description: p.name || '', material_code: p.material_code || '', category: p.category || '', qty: Number(it.qty) || 0, unit: p.uom || 'Pc', remarks: it.remarks || '' }
    })
  })
}
