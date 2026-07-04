import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Combobox } from '@/components/ui/Combobox'
import { Button } from '@/components/ui/Button'

import { CONDITION_OPTIONS as CONDITIONS } from '@/lib/conditions'
const DIRECTION = [{ id: 'in', label: 'Stock In (+)' }, { id: 'out', label: 'Stock Out (−)' }]
const MOVES = ['ADJUST', 'GRN', 'PUTAWAY', 'PICK', 'DELIVERY', 'RETURN', 'TRANSFER'].map(m => ({ id: m, label: m }))

export function StockAdjustModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [products, setProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState<any>({ stock_status: 'good', direction: 'in', movement_type: 'ADJUST', qty: '' })

  // Reset the form whenever the modal closes so it never reopens with stale input.
  useEffect(() => {
    if (!open) setF({ stock_status: 'good', direction: 'in', movement_type: 'ADJUST', qty: '' })
  }, [open])

  useEffect(() => {
    if (!open || !clientId) return
    supabase.from('products').select('id,name,material_code').eq('client_id', clientId).then(({ data }) => setProducts(data ?? []))
    supabase.from('warehouses').select('id,name,code').eq('client_id', clientId).then(({ data }) => setWarehouses(data ?? []))
  }, [open, clientId])
  useEffect(() => {
    if (!f.warehouse_id) { setLocations([]); return }
    supabase.from('locations').select('id,location_code').eq('warehouse_id', f.warehouse_id).then(({ data }) => setLocations(data ?? []))
  }, [f.warehouse_id])

  const save = async () => {
    const qty = Number(f.qty)
    if (!f.product_id || !f.warehouse_id) { notify('error', 'Product, warehouse and quantity required'); return }
    if (!Number.isFinite(qty) || qty <= 0) { notify('error', 'Quantity must be a positive number — pick In/Out for the direction'); return }
    setSaving(true)
    const { error } = await (supabase as any).rpc('post_stock_movement', {
      p_client: clientId, p_product: f.product_id, p_warehouse: f.warehouse_id,
      p_location: f.location_id || null, p_stock_status: f.stock_status,
      p_qty_in: f.direction === 'in' ? qty : 0, p_qty_out: f.direction === 'out' ? qty : 0,
      p_movement_type: f.movement_type, p_reference_type: 'MANUAL', p_remarks: f.remarks || null
    })
    setSaving(false)
    if (error) { notify('error', error.message); return }
    notify('success', 'Stock movement posted'); setF({ stock_status: 'good', direction: 'in', movement_type: 'ADJUST', qty: '' }); onDone()
  }

  return (
    <Modal open={open} onClose={onClose} title="Post Stock Movement">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Product" required className="sm:col-span-2">
          <Combobox value={f.product_id} placeholder="Search product…"
            options={products.map(p => ({ id: p.id, label: p.material_code, sub: p.name }))}
            onChange={v => setF((x: any) => ({ ...x, product_id: v }))} />
        </Field>
        <Field label="Warehouse" required>
          <Combobox value={f.warehouse_id} placeholder="Search warehouse…"
            options={warehouses.map(w => ({ id: w.id, label: w.code, sub: w.name }))}
            onChange={v => setF((x: any) => ({ ...x, warehouse_id: v, location_id: '' }))} />
        </Field>
        <Field label="Location">
          <Combobox value={f.location_id} placeholder="Search location…"
            options={locations.map(l => ({ id: l.id, label: l.location_code }))}
            onChange={v => setF((x: any) => ({ ...x, location_id: v }))} />
        </Field>
        <Field label="Direction" required>
          <Combobox value={f.direction} allowClear={false} options={DIRECTION} onChange={v => setF((x: any) => ({ ...x, direction: v }))} />
        </Field>
        <Field label="Quantity" required><Input type="number" step="any" value={f.qty} onChange={e => setF((x: any) => ({ ...x, qty: e.target.value }))} /></Field>
        <Field label="Condition"><Combobox value={f.stock_status} allowClear={false} options={CONDITIONS} onChange={v => setF((x: any) => ({ ...x, stock_status: v }))} /></Field>
        <Field label="Movement Type"><Combobox value={f.movement_type} allowClear={false} options={MOVES} onChange={v => setF((x: any) => ({ ...x, movement_type: v }))} /></Field>
        <Field label="Remarks" className="sm:col-span-2"><Textarea value={f.remarks ?? ''} onChange={e => setF((x: any) => ({ ...x, remarks: e.target.value }))} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon="check" loading={saving} onClick={save}>Post Movement</Button></div>
    </Modal>
  )
}
