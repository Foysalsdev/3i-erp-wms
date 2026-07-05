import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { SelectBox } from '@/components/ui/SelectBox'
import { Spinner } from '@/components/ui/States'
import {
  loadSettings, saveSettings, DEFAULT_BARCODE, type BarcodeSettings
} from '@/lib/settings'

const SYMBOLOGIES: BarcodeSettings['symbology'][] = ['CODE128', 'CODE39', 'EAN13', 'QR']

// Default symbology / prefix / label size used when printing product barcode
// labels. Stored per client.
export function BarcodeTab({ canEdit }: { canEdit: boolean }) {
  const { currentClientId } = useAuth()
  const notify = useUI(s => s.notify)
  const [form, setForm] = useState<BarcodeSettings>(DEFAULT_BARCODE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<BarcodeSettings>) => setForm(f => ({ ...f, ...patch }))

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    loadSettings<BarcodeSettings>(currentClientId, 'barcode').then(c => { setForm(c); setLoading(false) })
  }, [currentClientId])

  const save = async () => {
    if (!currentClientId) return
    setSaving(true)
    try {
      await saveSettings(currentClientId, 'barcode', form)
      notify('success', 'Barcode settings saved')
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save barcode settings')
    } finally { setSaving(false) }
  }

  if (loading) return <Card className="p-2"><Spinner label="Loading…" /></Card>
  const sample = `${form.prefix}1234567890`

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm text-ink-soft">Defaults applied when generating product barcode labels — the symbology, an optional prefix added to material codes, and the physical label size.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Symbology">
          <SelectBox value={form.symbology} disabled={!canEdit} onChange={e => set({ symbology: e.target.value as BarcodeSettings['symbology'] })}>
            {SYMBOLOGIES.map(s => <option key={s} value={s}>{s}</option>)}
          </SelectBox>
        </Field>
        <Field label="Code Prefix">
          <Input value={form.prefix} disabled={!canEdit} onChange={e => set({ prefix: e.target.value })} placeholder="e.g. WHP-" />
        </Field>
        <Field label="Label Width (mm)">
          <Input type="number" min={10} value={form.labelWidthMm} disabled={!canEdit} onChange={e => set({ labelWidthMm: Number(e.target.value) })} />
        </Field>
        <Field label="Label Height (mm)">
          <Input type="number" min={10} value={form.labelHeightMm} disabled={!canEdit} onChange={e => set({ labelHeightMm: Number(e.target.value) })} />
        </Field>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={form.showPrice} disabled={!canEdit} onChange={e => set({ showPrice: e.target.checked })} />
          <span className="text-sm text-ink">Show price on label</span>
        </label>
      </div>

      <div className="mt-5 rounded-lg border border-surface-line p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Label preview</p>
        <div className="inline-flex flex-col items-center gap-1 rounded border border-dashed border-slate-300 bg-white px-4 py-3">
          <div className="flex h-10 items-end gap-[2px]">
            {Array.from(sample).map((c, i) => (
              <span key={i} className="inline-block w-[3px] bg-slate-800" style={{ height: `${20 + (c.charCodeAt(0) % 20)}px` }} />
            ))}
          </div>
          <span className="font-mono text-[11px] tracking-widest text-slate-700">{sample}</span>
          <span className="text-[10px] text-slate-400">{form.symbology} · {form.labelWidthMm}×{form.labelHeightMm} mm</span>
        </div>
      </div>

      {canEdit && (
        <div className="mt-5 flex justify-end border-t border-surface-line pt-4">
          <Button icon="save" loading={saving} onClick={save}>Save Barcode Settings</Button>
        </div>
      )}
    </Card>
  )
}
