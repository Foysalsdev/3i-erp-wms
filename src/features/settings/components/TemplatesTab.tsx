import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { formatDate } from '@/lib/utils'

type Channel = 'print' | 'email'

// CRUD for print layouts / email templates (public.document_templates).
export function TemplatesTab({ channel, canEdit, canDelete }: { channel: Channel; canEdit: boolean; canDelete: boolean }) {
  const { data, loading, refresh } = useCollection('document_templates', { order: 'created_at' })
  const { currentClientId } = useAuth()
  const notify = useUI(s => s.notify)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)

  const rows = useMemo(() => (data as any[]).filter(r => r.channel === channel), [data, channel])

  const columns = [
    { key: 'code', header: 'Code', accessor: (r: any) => r.code, sortable: true, className: 'font-medium' },
    { key: 'name', header: 'Name', accessor: (r: any) => r.name },
    ...(channel === 'email' ? [{ key: 'subject', header: 'Subject', accessor: (r: any) => r.subject ?? '—' }] : []),
    { key: 'is_active', header: 'Status', render: (r: any) => <Badge tone={r.is_active ? 'positive' : 'neutral'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'updated_at', header: 'Updated', render: (r: any) => formatDate(r.updated_at) },
    ...(canEdit || canDelete ? [{
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => { setEditing(r); setModal(true) } }] : []),
            ...(canDelete ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }] : [])
  ]

  const title = channel === 'email' ? 'Email Template' : 'Print Template'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-soft">{rows.length} {title.toLowerCase()}{rows.length === 1 ? '' : 's'}</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New {title}</Button>}
      </div>
      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={canEdit ? (r: any) => { setEditing(r); setModal(true) } : undefined}
          emptyTitle={`No ${title.toLowerCase()}s yet`} />
      </Card>

      {modal && (
        <TemplateForm channel={channel} record={editing} clientId={currentClientId!} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `${title} · ${deleting.code}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('document_templates').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function TemplateForm({ channel, record, clientId, notify, onClose, onDone }: any) {
  const [f, setF] = useState<any>(record ?? { code: '', name: '', subject: '', body: '', is_active: true })
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }))
  const title = channel === 'email' ? 'Email Template' : 'Print Template'

  const save = async () => {
    if (!f.code?.trim() || !f.name?.trim()) { notify('error', 'Code and Name are required'); return }
    setSaving(true)
    try {
      const payload = {
        client_id: clientId, channel,
        code: f.code.trim(), name: f.name.trim(),
        subject: channel === 'email' ? (f.subject || null) : null,
        body: f.body || '', is_active: !!f.is_active
      }
      const res = record
        ? await supabase.from('document_templates').update(payload).eq('id', record.id)
        : await supabase.from('document_templates').insert(payload)
      if (res.error) throw res.error
      notify('success', `${title} ${record ? 'updated' : 'created'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? `Could not save ${title.toLowerCase()}`)
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`${record ? 'Edit' : 'New'} ${title}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code" required><Input value={f.code} onChange={e => set({ code: e.target.value })} placeholder="e.g. DELIVERY_CHALLAN" /></Field>
          <Field label="Name" required><Input value={f.name} onChange={e => set({ name: e.target.value })} /></Field>
          {channel === 'email' && (
            <Field label="Subject" className="sm:col-span-2"><Input value={f.subject ?? ''} onChange={e => set({ subject: e.target.value })} placeholder="Supports {{document_no}}, {{customer}} …" /></Field>
          )}
          <Field label={channel === 'email' ? 'Body' : 'Template Content / Header & Footer'} className="sm:col-span-2">
            <Textarea value={f.body} onChange={e => set({ body: e.target.value })} className="min-h-[160px]"
              placeholder={channel === 'email' ? 'Email body. Placeholders like {{document_no}} are substituted at send time.' : 'Header, terms & footer text for the printed document.'} />
          </Field>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={!!f.is_active} onChange={e => set({ is_active: e.target.checked })} />
            <span className="text-sm text-ink">Active</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  )
}
