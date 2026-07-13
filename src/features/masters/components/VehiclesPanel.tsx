import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { SelectBox } from '@/components/ui/SelectBox'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/States'
import { formatDate, formatVehicleNo } from '@/lib/utils'

// Multi-vehicle support under a transport vendor.
export function VehiclesPanel({ vendorId }: { vendorId: string }) {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<Tables<'vehicles'>[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Tables<'vehicles'>>>({ status: 'active' })
  const load = () => supabase.from('vehicles').select('*').eq('vendor_id', vendorId).then(({ data }) => setRows(data ?? []))
  useEffect(() => { load() }, [vendorId])

  const save = async () => {
    if (!form.vehicle_number) { notify('error', 'Vehicle number required'); return }
    const { error } = await supabase.from('vehicles').insert({ ...form, vehicle_number: form.vehicle_number, vendor_id: vendorId, })
    if (error) { notify('error', error.message); return }
    setOpen(false); setForm({ status: 'active' }); load(); notify('success', 'Vehicle added')
  }
  type VehicleKey = keyof Tables<'vehicles'>
  const F = (k: VehicleKey, label: string, type = 'text') =>
    <Field label={label}><Input type={type} value={String(form[k] ?? '')} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></Field>

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" icon="add" onClick={() => setOpen(true)}>Add Vehicle</Button></div>
      {rows.length === 0 ? <EmptyState icon="local_shipping" title="No vehicles" /> :
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(v => (
            <div key={v.id} className="rounded-card border border-horizon-line p-3 text-sm">
              <div className="flex items-center justify-between"><b>{v.vehicle_number}</b><StatusBadge status={v.status} /></div>
              <p className="text-horizon-muted">{v.vehicle_type} · {v.capacity}</p>
              <p>Driver: {v.driver_name ?? '—'} ({v.driver_phone ?? '—'})</p>
              <p className="text-[11px] text-horizon-muted">License exp: {formatDate(v.license_expiry)} · Fitness: {formatDate(v.fitness_expiry)} · Insurance: {formatDate(v.insurance_expiry)}</p>
            </div>
          ))}
        </div>}
      <Modal open={open} onClose={() => setOpen(false)} title="Add Vehicle">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {F('vehicle_type', 'Vehicle Type')}
          {F('capacity', 'Vehicle Size / Capacity')}
          <Field label="Vehicle Number"><Input value={form.vehicle_number ?? ''} placeholder="DM TA 00-0000" onChange={e => setForm(f => ({ ...f, vehicle_number: formatVehicleNo(e.target.value) }))} /></Field>
          {F('driver_name', 'Assigned Driver Name')}
          {F('driver_phone', 'Driver Phone')}
          {F('license_number', 'Driving License Number')}
          {F('license_expiry', 'License Expiry', 'date')}
          {F('fitness_expiry', 'Fitness Expiry', 'date')}
          {F('insurance_expiry', 'Insurance Expiry', 'date')}
          <Field label="Status"><SelectBox value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><option value="active">active</option><option value="inactive">inactive</option></SelectBox></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button icon="save" onClick={save}>Save</Button></div>
      </Modal>
    </div>
  )
}
