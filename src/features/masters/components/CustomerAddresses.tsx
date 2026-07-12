import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import type { Tables } from '@/types/database.types'

// Multiple addresses per customer (head office to bill, branch stores to
// ship). Used by the Delivery Challan's Bill-To / Ship-To pickers. Kept as a
// focused modal rather than wired into the generic master form, since that
// form only handles flat fields.
type CustomerAddress = Tables<'customer_addresses'>
type EditingAddress = Partial<CustomerAddress> & { address_type: string | null; is_default: boolean }

const TYPES = ['Billing', 'Shipping', 'Both']
const blank = (): EditingAddress => ({ label: '', address_type: 'Shipping', address: '', is_default: false })

export function CustomerAddresses({ customer, onClose }: { customer: { id: string; name?: string | null }; onClose: () => void }) {
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('masters.create') || can('masters.edit')
  const [rows, setRows] = useState<CustomerAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingAddress | null>(null) // the row being added/edited
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    supabase.from('customer_addresses').select('*').eq('customer_id', customer.id)
      .then(({ data }) => { setRows(data ?? []); setLoading(false) })
  }
  useEffect(load, [customer.id])

  const save = async () => {
    if (!editing?.address?.trim()) { notify('error', 'Enter the address'); return }
    setSaving(true)
    const payload = {
      client_id: currentClientId!, customer_id: customer.id,
      label: editing.label || null, address_type: editing.address_type || null,
      address: editing.address.trim(), is_default: !!editing.is_default
    }
    // Only one default per customer — clear the others first when this is set.
    if (payload.is_default) await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', customer.id)
    const res = editing.id
      ? await supabase.from('customer_addresses').update(payload).eq('id', editing.id)
      : await supabase.from('customer_addresses').insert(payload)
    setSaving(false)
    if (res.error) { notify('error', res.error.message); return }
    notify('success', editing.id ? 'Address updated' : 'Address added')
    setEditing(null); load()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('customer_addresses').delete().eq('id', id)
    if (error) { notify('error', error.message); return }
    notify('success', 'Address removed'); load()
  }

  return (
    <Modal open onClose={onClose} title={`Addresses — ${customer.name}`} size="lg">
      <div className="space-y-4">
        {loading ? <p className="text-sm text-ink-faint">Loading…</p> : rows.length === 0 && !editing ? (
          <p className="rounded-xl border border-dashed border-surface-line px-3 py-4 text-sm text-ink-faint">
            No saved addresses yet. Add the customer's head office (billing) and any branch/store delivery points here — then a challan can pick from them.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-surface-line p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{r.label || r.address_type || 'Address'}</span>
                    {r.address_type && <Badge tone="neutral">{r.address_type}</Badge>}
                    {r.is_default && <Badge tone="positive">Default</Badge>}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{r.address}</p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <button className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink" onClick={() => setEditing(r)}><Icon name="edit" className="text-[18px]" /></button>
                    <button className="rounded-lg p-1.5 text-ink-faint hover:bg-bad/10 hover:text-bad" onClick={() => remove(r.id)}><Icon name="delete" className="text-[18px]" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {editing ? (
          <div className="rounded-xl border border-surface-line bg-surface-sunken/40 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Label"><Input value={editing.label ?? ''} onChange={e => setEditing({ ...editing, label: e.target.value })} placeholder="e.g. Head Office, Khulna Branch" /></Field>
              <Field label="Type">
                <Select value={editing.address_type ?? 'Shipping'} onChange={e => setEditing({ ...editing, address_type: e.target.value })}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Address" required className="sm:col-span-2"><Textarea value={editing.address ?? ''} onChange={e => setEditing({ ...editing, address: e.target.value })} placeholder="Full address" /></Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={!!editing.is_default} onChange={e => setEditing({ ...editing, is_default: e.target.checked })} />
              Set as the default address for this customer
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button icon="save" loading={saving} onClick={save}>{editing.id ? 'Update' : 'Add'}</Button>
            </div>
          </div>
        ) : canEdit && (
          <Button variant="secondary" icon="add" onClick={() => setEditing(blank())}>Add Address</Button>
        )}

        <div className="flex justify-end border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}
