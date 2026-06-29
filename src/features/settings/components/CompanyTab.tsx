import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/States'
import {
  loadSettings, saveSettings, setCompanyCache,
  DEFAULT_COMPANY, type CompanySettings
} from '@/lib/settings'

// Company profile printed on every PDF (challan, gate pass, reports …).
export function CompanyTab({ canEdit }: { canEdit: boolean }) {
  const { currentClientId } = useAuth()
  const notify = useUI(s => s.notify)
  const [form, setForm] = useState<CompanySettings>(DEFAULT_COMPANY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<CompanySettings>) => setForm(f => ({ ...f, ...patch }))

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    loadSettings<CompanySettings>(currentClientId, 'company').then(c => { setForm(c); setLoading(false) })
  }, [currentClientId])

  const save = async () => {
    if (!currentClientId) return
    setSaving(true)
    try {
      await saveSettings(currentClientId, 'company', form)
      setCompanyCache(currentClientId, form)   // refresh the PDF cache immediately
      notify('success', 'Company settings saved — documents will use these details')
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save company settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Card className="p-2"><Spinner label="Loading…" /></Card>

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm text-ink-soft">These details appear on the header and footer of every printed document (delivery challan, gate pass, stock reports and record sheets) for the active client.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Company Name" className="sm:col-span-2" required>
          <Input value={form.name} disabled={!canEdit} onChange={e => set({ name: e.target.value })} placeholder="WHIRLPOOL BANGLADESH LIMITED" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea value={form.address} disabled={!canEdit} onChange={e => set({ address: e.target.value })} placeholder="One line per row — printed as-is" className="min-h-[70px]" />
        </Field>
        <Field label="Phone"><Input value={form.phone} disabled={!canEdit} onChange={e => set({ phone: e.target.value })} /></Field>
        <Field label="Email"><Input value={form.email} disabled={!canEdit} onChange={e => set({ email: e.target.value })} /></Field>
        <Field label="Website"><Input value={form.website} disabled={!canEdit} onChange={e => set({ website: e.target.value })} /></Field>
        <Field label="BIN / TIN / Tax ID"><Input value={form.bin} disabled={!canEdit} onChange={e => set({ bin: e.target.value })} /></Field>
        <Field label="Logo URL (optional — overrides default logo)" className="sm:col-span-2">
          <Input value={form.logoUrl} disabled={!canEdit} onChange={e => set({ logoUrl: e.target.value })} placeholder="https://… or /whirlpool-logo.png" />
        </Field>
        <Field label="Bank Details" className="sm:col-span-2">
          <Textarea value={form.bankDetails} disabled={!canEdit} onChange={e => set({ bankDetails: e.target.value })} />
        </Field>
        <Field label="Document Footer Note" className="sm:col-span-2">
          <Textarea value={form.footer} disabled={!canEdit} onChange={e => set({ footer: e.target.value })} />
        </Field>
      </div>
      {canEdit && (
        <div className="mt-5 flex justify-end border-t border-surface-line pt-4">
          <Button icon="save" loading={saving} onClick={save}>Save Company Settings</Button>
        </div>
      )}
    </Card>
  )
}
