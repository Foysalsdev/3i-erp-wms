import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Icon } from '@/components/ui/Icon'

// Uploads to the public 'media' Supabase Storage bucket; falls back to manual URL entry.
export function ImageUpload({ value, onChange, label }: { value?: string; onChange: (url: string) => void; label?: string }) {
  const clientId = useAuth(s => s.currentClientId)
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()

  const pick = async (file: File) => {
    setBusy(true); setErr(undefined)
    const path = `${clientId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
    if (error) { setErr('Upload unavailable — paste an image URL instead'); setBusy(false); return }
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    onChange(data.publicUrl); setBusy(false)
  }

  return (
    <div>
      {label && <label className="fiori-label">{label}</label>}
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-card border border-surface-line bg-surface-sunken">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <Icon name="image" className="text-ink-faint text-[24px]" />}
        </div>
        <div className="flex-1 space-y-1">
          <button type="button" onClick={() => ref.current?.click()}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">
            <Icon name={busy ? 'progress_activity' : 'upload'} className={busy ? 'animate-spin text-[16px]' : 'text-[16px]'} /> Upload
          </button>
          <input ref={ref} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && pick(e.target.files[0])} />
          <input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder="…or paste image URL"
            className="fiori-input" />
          {err && <p className="text-[11px] text-horizon-critical">{err}</p>}
        </div>
      </div>
    </div>
  )
}
