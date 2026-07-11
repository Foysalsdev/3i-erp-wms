import { supabase } from '@/lib/supabase'

// Shared by the Delivery Challan list's "Print challan" action and the Sales
// Order Overview's per-delivery download button, so both produce the exact
// same PDF from the same mapping logic.
import type { Tables } from '@/types/database.types'

type ProductInfo = Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'category' | 'uom'>
type CustomerInfo = Pick<Tables<'customers'>, 'id' | 'customer_code' | 'name'>
type VehicleInfo = Pick<Tables<'vehicles'>, 'id' | 'vehicle_number'>

export async function downloadChallanPdfFor(challan: Tables<'delivery_challans'>, { customers, vehicles, products }: { customers: CustomerInfo[]; vehicles: VehicleInfo[]; products: ProductInfo[] }) {
  const { data: items } = await supabase.from('delivery_challan_items').select('*').eq('challan_id', challan.id)
  const pmap: Record<string, ProductInfo> = {}; products.forEach(p => { pmap[p.id] = p })
  const cust = customers.find(x => x.id === challan.customer_id)
  const veh = vehicles.find(x => x.id === challan.vehicle_id)
  const { downloadChallanPDF } = await import('@/pdf/DeliveryChallanPDF')
  await downloadChallanPDF({
    challan,
    customerName: cust ? `${cust.customer_code} - ${cust.name}` : '',
    vehicleNo: veh?.vehicle_number || '',
    items: (items ?? []).map((it, i) => {
      const p: Partial<ProductInfo> = (it.product_id ? pmap[it.product_id] : undefined) ?? {}
      return { sl: i + 1, description: p.name || '', material_code: p.material_code || '', category: p.category || '', qty: Number(it.qty) || 0, unit: p.uom || 'Pc', remarks: it.remarks || '' }
    })
  })
}
