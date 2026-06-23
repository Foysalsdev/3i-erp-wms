import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'

export interface Opt { id: string; label: string; sub?: string; extra?: any }

// Lookups shared by inbound & outbound documents (client-scoped).
export function useInboundData() {
  const clientId = useAuth(s => s.currentClientId)
  const [suppliers, setSuppliers] = useState<Opt[]>([])
  const [customers, setCustomers] = useState<Opt[]>([])
  const [warehouses, setWarehouses] = useState<Opt[]>([])
  const [products, setProducts] = useState<Opt[]>([])
  const [locations, setLocations] = useState<Opt[]>([])
  const [transporters, setTransporters] = useState<Opt[]>([])
  const [vehicles, setVehicles] = useState<Opt[]>([])
  const [drivers, setDrivers] = useState<Opt[]>([])

  useEffect(() => {
    if (!clientId) return
    supabase.from('suppliers').select('id,supplier_code,name').eq('client_id', clientId).eq('status', 'active')
      .then(({ data }) => setSuppliers((data ?? []).map(s => ({ id: s.id, label: s.supplier_code, sub: s.name }))))
    supabase.from('customers').select('id,customer_code,name').eq('client_id', clientId).eq('status', 'active')
      .then(({ data }) => setCustomers((data ?? []).map(c => ({ id: c.id, label: c.customer_code, sub: c.name }))))
    supabase.from('warehouses').select('id,code,name').eq('client_id', clientId).eq('status', 'active')
      .then(({ data }) => setWarehouses((data ?? []).map(w => ({ id: w.id, label: w.code, sub: w.name }))))
    supabase.from('products').select('id,material_code,name').eq('client_id', clientId).eq('status', 'active')
      .then(({ data }) => setProducts((data ?? []).map(p => ({ id: p.id, label: p.material_code, sub: p.name }))))
    supabase.from('locations').select('id,location_code,warehouse_id').eq('client_id', clientId)
      .then(({ data }) => setLocations((data ?? []).map(l => ({ id: l.id, label: l.location_code, extra: l.warehouse_id }))))
    supabase.from('transport_vendors').select('id,vendor_code,name').eq('client_id', clientId).eq('status', 'active')
      .then(({ data }) => setTransporters((data ?? []).map(v => ({ id: v.id, label: v.vendor_code, sub: v.name }))))
    supabase.from('vehicles').select('id,vehicle_number,vehicle_type').eq('client_id', clientId)
      .then(({ data }) => setVehicles((data ?? []).map(v => ({ id: v.id, label: v.vehicle_number, sub: v.vehicle_type ?? undefined }))))
    supabase.from('drivers' as any).select('id,driver_code,name').eq('client_id', clientId).eq('status', 'active')
      .then(({ data }) => setDrivers(((data ?? []) as any[]).map(d => ({ id: d.id, label: d.driver_code, sub: d.name }))))
  }, [clientId])

  return { clientId, suppliers, customers, warehouses, products, locations, transporters, vehicles, drivers }
}

export const STATUS_TONE: Record<string, any> = {
  draft: 'neutral', posted: 'info', received: 'positive', delivered: 'positive', cancelled: 'negative'
}
