import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { RELATIONS, type MasterDef, type MasterRecord } from '../registry'
import { Field, Input, Textarea, type FieldSize } from '@/components/ui/Field'
import { SelectBox } from '@/components/ui/SelectBox'
import { Combobox } from '@/components/shared/Combobox'
import { Button } from '@/components/ui/Button'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { ImageUpload } from './ImageUpload'
import { formatVehicleNo } from '@/lib/utils'

export function MasterForm({ def, record, onDone, onCancel }:
  { def: MasterDef; record?: MasterRecord | null; onDone: () => void; onCancel: () => void }) {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [saving, setSaving] = useState(false)
  // Relation options carry code + name separately so the smart lookup can show
  // the code as a mono chip and the description beside it, and search both.
  const [relOptions, setRelOptions] = useState<Record<string, { id: string; label: string; sublabel?: string }[]>>({})
  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm({
    mode: 'onChange',  // live validation: required errors clear the moment a field is filled
    defaultValues: record ?? { status: 'active', uom: 'PCS', unit: 'PCS' }
  })
  useUnsavedChanges(isDirty && !saving)

  // Smart focus: land the cursor on the first real field when the form opens.
  // [name] targets react-hook-form inputs, skipping the combobox search inputs
  // (which would otherwise pop their dropdown open on mount).
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const el = formRef.current?.querySelector<HTMLElement>('input[name]:not([disabled]), textarea[name], select[name]')
    el?.focus()
  }, [])

  // Load linked dropdown options for relation fields
  useEffect(() => {
    if (!clientId) return
    def.fields.filter(f => f.relation).forEach(async f => {
      const rel = RELATIONS[f.relation!]
      const { data } = await supabase.from(rel.table as any).select(`id, ${rel.code}, ${rel.name}`)
      setRelOptions(o => ({
        ...o,
        [f.name]: ((data ?? []) as unknown as Record<string, string>[]).map(r => ({ id: r.id, label: r[rel.code], sublabel: r[rel.name] }))
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
      const payload: Record<string, unknown> = {}
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

  // Field width in the 12-col grid: full for wide/rich types, small for
  // date/number, half otherwise — overridable per field via `size` in registry.
  const sizeFor = (f: typeof def.fields[number]): FieldSize =>
    f.span2 || f.type === 'textarea' || f.type === 'image' ? 'full'
    : f.size ? f.size
    : f.type === 'date' || f.type === 'number' ? 'sm'
    : 'lg'

  return (
    <form ref={formRef} onSubmit={handleSubmit(submit, onInvalid)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        {def.fields.map(f => {
          if (f.type === 'image')
            return <div key={f.name} className="sm:col-span-12"><ImageUpload label={f.label} value={watch(f.name) as string | undefined} onChange={v => setValue(f.name, v)} /></div>
          if (f.type === 'checkbox')
            return (
              <label key={f.name} className="flex items-center gap-2 rounded-lg border border-surface-line px-3 py-2.5 text-sm sm:col-span-4">
                <input type="checkbox" {...register(f.name)} className="h-4 w-4 accent-brand-500" /> {f.label}
              </label>
            )
          return (
            <Field key={f.name} label={f.label} required={f.required} size={sizeFor(f)}
              error={errors[f.name] ? `${f.label} is required` : undefined}>
              {f.type === 'textarea' ? <Textarea {...register(f.name, { required: f.required })} placeholder={f.placeholder} />
              : f.relation ? (() => {
                // Many-record master data (warehouse, transporter, vehicle…) →
                // searchable smart lookup, never a long native dropdown.
                register(f.name, { required: f.required })
                return (
                  <Combobox items={relOptions[f.name] ?? []} value={String(watch(f.name) ?? '')}
                    onChange={id => setValue(f.name, id, { shouldValidate: true })}
                    placeholder={`Search ${f.label.toLowerCase()}…`} />
                )
              })() : f.type === 'select' ? (() => {
                // Small fixed option set (status, category, terms…) → dropdown.
                register(f.name, { required: f.required })
                return (
                  <SelectBox value={String(watch(f.name) ?? '')}
                    onChange={e => setValue(f.name, e.target.value, { shouldValidate: true })}>
                    <option value="">Select…</option>
                    {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
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
