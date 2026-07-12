import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { RELATIONS, type MasterDef, type MasterRecord } from '../registry'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { SelectBox } from '@/components/ui/SelectBox'
import { Button } from '@/components/ui/Button'
import { ImageUpload } from './ImageUpload'
import { formatVehicleNo } from '@/lib/utils'

export function MasterForm({ def, record, onDone, onCancel }:
  { def: MasterDef; record?: MasterRecord | null; onDone: () => void; onCancel: () => void }) {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [saving, setSaving] = useState(false)
  const [relOptions, setRelOptions] = useState<Record<string, { id: string; label: string }[]>>({})
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: record ?? { status: 'active', uom: 'PCS', unit: 'PCS' }
  })

  // Load linked dropdown options for relation fields
  useEffect(() => {
    if (!clientId) return
    def.fields.filter(f => f.relation).forEach(async f => {
      const rel = RELATIONS[f.relation!]
      const { data } = await supabase.from(rel.table as any).select(`id, ${rel.code}, ${rel.name}`).eq('client_id', clientId)
      setRelOptions(o => ({
        ...o,
        [f.name]: ((data ?? []) as unknown as Record<string, string>[]).map(r => ({ id: r.id, label: `${r[rel.code]}${r[rel.name] ? ' — ' + r[rel.name] : ''}` }))
      }))
      // Re-apply the record's value once options exist — at mount the matching
      // <option> isn't rendered yet, so the native select can't show it.
      if (record && record[f.name] != null) setValue(f.name, record[f.name])
    })
  }, [def, clientId, record, setValue])

  const submit = async (values: Record<string, unknown>) => {
    if (!clientId) { notify('error', 'No client selected. Pick a client first.'); return }
    setSaving(true)
    try {
      // Build the payload from this master's own fields only, so stray form
      // defaults (e.g. the uom/unit seed values) never get sent to a table
      // that has no such column — which Supabase rejects outright.
      const payload: Record<string, unknown> = { client_id: clientId }
      def.fields.forEach(f => {
        let v = values[f.name]
        if (f.type === 'number') v = v === '' || v == null ? null : Number(v)
        else if (f.type === 'checkbox') v = !!v
        else if ((f.relation || f.type === 'date') && v === '') v = null
        payload[f.name] = v
      })
      const res = record
        ? await supabase.from(def.table as any).update(payload).eq('id', record.id)
        : await supabase.from(def.table as any).insert(payload)
      if (res.error) { notify('error', res.error.message); return }
      notify('success', `${def.singular} ${record ? 'updated' : 'created'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // Surface validation failures so the form never fails silently.
  const onInvalid = () => notify('error', 'Please fill in all required fields highlighted below.')

  return (
    <form onSubmit={handleSubmit(submit, onInvalid)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {def.fields.map(f => {
          if (f.type === 'image')
            return <div key={f.name} className="sm:col-span-2"><ImageUpload label={f.label} value={watch(f.name) as string | undefined} onChange={v => setValue(f.name, v)} /></div>
          if (f.type === 'checkbox')
            return (
              <label key={f.name} className="flex items-center gap-2 rounded-lg border border-surface-line px-3 py-2.5 text-sm">
                <input type="checkbox" {...register(f.name)} className="h-4 w-4 accent-brand-500" /> {f.label}
              </label>
            )
          const opts = f.relation ? (relOptions[f.name] ?? []) : (f.options?.map(o => ({ id: o, label: o })) ?? [])
          return (
            <Field key={f.name} label={f.label} required={f.required} className={f.span2 ? 'sm:col-span-2' : ''}
              error={errors[f.name] ? `${f.label} is required` : undefined}>
              {f.type === 'textarea' ? <Textarea {...register(f.name, { required: f.required })} placeholder={f.placeholder} />
              : (f.type === 'select' || f.relation) ? (() => {
                register(f.name, { required: f.required })
                return (
                  <SelectBox value={String(watch(f.name) ?? '')}
                    onChange={e => setValue(f.name, e.target.value, { shouldValidate: true })}>
                    <option value="">Select…</option>
                    {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </SelectBox>
                )
              })() : (() => {
                const reg = register(f.name, { required: f.required })
                return <Input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step="any"
                  {...reg} placeholder={f.placeholder}
                  onChange={f.format === 'vehicleNo' ? (e: React.ChangeEvent<HTMLInputElement>) => { e.target.value = formatVehicleNo(e.target.value); reg.onChange(e) } : reg.onChange} />
              })()}
              {f.help && <p className="mt-1 text-[11px] text-ink-faint">{f.help}</p>}
            </Field>
          )
        })}
      </div>
      <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving} icon="save">{record ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  )
}
