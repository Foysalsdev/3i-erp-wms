import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { RELATIONS, type MasterDef } from '../registry'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ImageUpload } from './ImageUpload'

export function MasterForm({ def, record, onDone, onCancel }:
  { def: MasterDef; record?: any; onDone: () => void; onCancel: () => void }) {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [saving, setSaving] = useState(false)
  const [relOptions, setRelOptions] = useState<Record<string, { id: string; label: string }[]>>({})
  const { register, handleSubmit, watch, setValue } = useForm({
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
        [f.name]: (data ?? []).map((r: any) => ({ id: r.id, label: `${r[rel.code]}${r[rel.name] ? ' — ' + r[rel.name] : ''}` }))
      }))
    })
  }, [def, clientId])

  const submit = async (values: any) => {
    setSaving(true)
    def.fields.filter(f => f.type === 'number').forEach(f => {
      values[f.name] = values[f.name] === '' || values[f.name] == null ? null : Number(values[f.name])
    })
    def.fields.filter(f => f.type === 'checkbox').forEach(f => { values[f.name] = !!values[f.name] })
    def.fields.filter(f => f.relation || f.type === 'date').forEach(f => {
      if (values[f.name] === '') values[f.name] = null
    })
    const payload = { ...values, client_id: clientId }
    const res = record
      ? await supabase.from(def.table as any).update(payload).eq('id', record.id)
      : await supabase.from(def.table as any).insert(payload)
    setSaving(false)
    if (res.error) { notify('error', res.error.message); return }
    notify('success', `${def.singular} ${record ? 'updated' : 'created'}`)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {def.fields.map(f => {
          if (f.type === 'image')
            return <div key={f.name} className="sm:col-span-2"><ImageUpload label={f.label} value={watch(f.name)} onChange={v => setValue(f.name, v)} /></div>
          if (f.type === 'checkbox')
            return (
              <label key={f.name} className="flex items-center gap-2 rounded-lg border border-surface-line px-3 py-2.5 text-sm">
                <input type="checkbox" {...register(f.name)} className="h-4 w-4 accent-brand-500" /> {f.label}
              </label>
            )
          const opts = f.relation ? (relOptions[f.name] ?? []) : (f.options?.map(o => ({ id: o, label: o })) ?? [])
          return (
            <Field key={f.name} label={f.label} required={f.required} className={f.span2 ? 'sm:col-span-2' : ''}>
              {f.type === 'textarea' ? <Textarea {...register(f.name, { required: f.required })} placeholder={f.placeholder} />
              : (f.type === 'select' || f.relation) ? (
                <Select {...register(f.name, { required: f.required })}>
                  <option value="">Select…</option>
                  {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </Select>
              ) : <Input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step="any"
                    {...register(f.name, { required: f.required })} placeholder={f.placeholder} />}
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
