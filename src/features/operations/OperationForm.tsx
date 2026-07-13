import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { OP_RELATIONS, type OpDef, type OpRecord } from './registry'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { SelectBox } from '@/components/ui/SelectBox'
import { Button } from '@/components/ui/Button'
import { ImageUpload } from '@/features/masters/components/ImageUpload'

const today = () => new Date().toISOString().slice(0, 10)

export function OperationForm({ def, record, onDone, onCancel }:
  { def: OpDef; record?: OpRecord | null; onDone: () => void; onCancel: () => void }) {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [saving, setSaving] = useState(false)
  const [relOptions, setRelOptions] = useState<Record<string, { id: string; label: string }[]>>({})

  const defaults = record ?? {
    status: def.statuses[0]?.value,
    ...Object.fromEntries(def.fields.filter(f => f.type === 'date' && f.required).map(f => [f.name, today()]))
  }
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({ defaultValues: defaults })

  // Load linked dropdown options for relation fields.
  useEffect(() => {
    if (!clientId) return
    def.fields.filter(f => f.relation).forEach(async f => {
      const rel = OP_RELATIONS[f.relation!]
      const cols = ['id', rel.code, rel.name].filter(Boolean).join(', ')
      const { data } = await supabase.from(rel.table as any).select(cols)
      setRelOptions(o => ({
        ...o,
        [f.name]: ((data ?? []) as unknown as Record<string, string>[]).map(r => ({
          id: r.id, label: rel.name ? `${r[rel.code]}${r[rel.name] ? ' — ' + r[rel.name] : ''}` : r[rel.code]
        }))
      }))
      // Re-apply the saved value once options exist (native select needs the option present).
      if (record && record[f.name] != null) setValue(f.name, record[f.name])
    })
  }, [def, clientId, record, setValue])

  const submit = async (values: Record<string, unknown>) => {
    if (!clientId) { notify('error', 'No client selected. Pick a client first.'); return }
    setSaving(true)
    try {
      // Build the payload from this document's own fields only.
      const payload: Record<string, unknown> = { }
      def.fields.forEach(f => {
        let v = values[f.name]
        if (f.type === 'number') v = v === '' || v == null ? null : Number(v)
        else if ((f.type === 'relation' || f.type === 'date') && v === '') v = null
        payload[f.name] = v
      })

      let res
      if (record) {
        res = await supabase.from(def.table as any).update(payload).eq('id', record.id)
      } else {
        // Generate the document number atomically server-side on create.
        const docNo = await nextDocNumber(clientId, def.docType)
        if (!docNo) { notify('error', 'Could not generate document number.'); return }
        payload[def.numberField] = docNo
        res = await supabase.from(def.table as any).insert(payload)
      }
      if (res.error) { notify('error', res.error.message); return }
      notify('success', `${def.singular} ${record ? 'updated' : 'created'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const onInvalid = () => notify('error', 'Please fill in all required fields highlighted below.')

  return (
    <form onSubmit={handleSubmit(submit, onInvalid)} className="space-y-4">
      {record && (
        <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm">
          <span className="text-ink-faint">Document No: </span>
          <span className="font-semibold text-ink">{String(record[def.numberField] ?? '')}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {def.fields.map(f => {
          if (f.type === 'image')
            return <div key={f.name} className={f.span2 ? 'sm:col-span-2' : ''}>
              <ImageUpload label={f.label} value={watch(f.name) as string | undefined} onChange={v => setValue(f.name, v)} />
            </div>
          const opts = f.relation ? (relOptions[f.name] ?? [])
            : (f.options?.map(o => ({ id: o, label: o })) ?? [])
          return (
            <Field key={f.name} label={f.label} required={f.required} className={f.span2 ? 'sm:col-span-2' : ''}
              error={errors[f.name] ? `${f.label} is required` : undefined}>
              {f.type === 'textarea' ? (
                <Textarea {...register(f.name, { required: f.required })} placeholder={f.placeholder} />
              ) : (f.type === 'select' || f.type === 'relation') ? (() => {
                register(f.name, { required: f.required })
                return (
                  <SelectBox value={String(watch(f.name) ?? '')}
                    onChange={e => setValue(f.name, e.target.value, { shouldValidate: true })}>
                    <option value="">Select…</option>
                    {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </SelectBox>
                )
              })() : (
                <Input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step="any"
                  {...register(f.name, { required: f.required })} placeholder={f.placeholder} />
              )}
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
