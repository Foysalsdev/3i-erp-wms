import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/store/ui'
import { useTimeline } from '@/hooks/useTimeline'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/States'
import { formatDateTime } from '@/lib/utils'
import type { Tables } from '@/types/database.types'

export function NotesPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<Tables<'notes'>[]>([])
  const [body, setBody] = useState('')
  const load = () => supabase.from('notes').select('*').eq('entity_type', entityType).eq('entity_id', entityId)
    .order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) notify('error', `Could not load notes: ${error.message}`)
      setRows(data ?? [])
    })
  useEffect(() => { load() }, [entityType, entityId])
  const add = async () => {
    if (!body.trim()) return
    const { error } = await supabase.from('notes').insert({ entity_type: entityType, entity_id: entityId, body, created_by: (await supabase.auth.getUser()).data.user?.id })
    if (error) { notify('error', error.message); return }
    setBody(''); load()
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={body} onChange={e => setBody(e.target.value)} placeholder="Add a note / remark…" onKeyDown={e => e.key === 'Enter' && add()} />
        <Button onClick={add} icon="add">Add</Button>
      </div>
      {rows.length === 0 ? <EmptyState icon="sticky_note_2" title="No notes yet" /> :
        <div className="space-y-2">
          {rows.map(n => (
            <div key={n.id} className="rounded-lg border border-horizon-line p-3 text-sm">
              <p>{n.body}</p>
              <p className="mt-1 text-[11px] text-horizon-muted">{formatDateTime(n.created_at)}</p>
            </div>
          ))}
        </div>}
    </div>
  )
}

export function AttachmentsPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<Tables<'attachments'>[]>([])
  const [busy, setBusy] = useState(false)
  const load = () => supabase.from('attachments').select('*').eq('entity_type', entityType).eq('entity_id', entityId)
    .order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) notify('error', `Could not load attachments: ${error.message}`)
      setRows(data ?? [])
    })
  useEffect(() => { load() }, [entityType, entityId])

  const upload = async (file: File) => {
    setBusy(true)
    const path = `${entityType}/${entityId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const up = await supabase.storage.from('media').upload(path, file, { upsert: true })
    if (up.error) { notify('error', 'Storage upload failed'); setBusy(false); return }
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    await supabase.from('attachments').insert({
      entity_type: entityType, entity_id: entityId,
      file_name: file.name, file_type: file.type, file_size: file.size, storage_path: path, drive_url: data.publicUrl, source: 'supabase'
    })
    setBusy(false); load(); notify('success', 'File attached')
  }
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-horizon-line py-6 text-sm text-horizon-muted hover:border-brand-300">
        <Icon name={busy ? 'progress_activity' : 'cloud_upload'} className={busy ? 'animate-spin' : ''} /> {busy ? 'Uploading…' : 'Upload file (Supabase Storage / Google Drive)'}
        <input type="file" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {rows.length === 0 ? <EmptyState icon="attach_file" title="No attachments" /> :
        <div className="divide-y divide-horizon-line">
          {rows.map(a => (
            <a key={a.id} href={a.drive_url ?? undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-2 text-sm hover:text-brand-600">
              <Icon name={a.source === 'google_drive' ? 'add_to_drive' : 'description'} className="text-brand-500" />
              <span className="flex-1 truncate">{a.file_name}</span>
              <Icon name="open_in_new" className="text-[16px] text-ink-faint" />
            </a>
          ))}
        </div>}
    </div>
  )
}

export function TimelinePanel({ table, recordId }: { table: string; recordId: string }) {
  const { rows, loading } = useTimeline(table, recordId)
  if (loading) return <p className="py-4 text-sm text-horizon-muted">Loading…</p>
  if (!rows.length) return <EmptyState icon="history" title="No activity recorded" />
  const tone: Record<string, string> = { INSERT: 'text-green-600', UPDATE: 'text-blue-600', DELETE: 'text-red-600' }
  return (
    <div className="space-y-0">
      {rows.map(r => (
        <div key={r.id} className="flex gap-3 pb-4">
          <div className="flex flex-col items-center">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-surface-sunken ${tone[r.action]}`}>
              <Icon name={r.action === 'INSERT' ? 'add' : r.action === 'UPDATE' ? 'edit' : 'delete'} className="text-[16px]" />
            </span>
            <span className="my-1 w-px flex-1 bg-horizon-line" />
          </div>
          <div className="pb-1 text-sm">
            <p className="font-medium">{r.action === 'INSERT' ? 'Record created' : r.action === 'UPDATE' ? 'Record updated' : 'Record deleted'}</p>
            <p className="text-[11px] text-horizon-muted">{formatDateTime(r.changed_at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
