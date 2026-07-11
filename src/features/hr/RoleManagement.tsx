import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/States'
import { Icon } from '@/components/ui/Icon'

const ACTIONS = ['view', 'create', 'edit', 'delete', 'post', 'approve']
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'role'

// Manage custom roles and grant access per-permission (module × action matrix).
export function RoleManagement() {
  const canManage = useAuth(s => s.isPlatformAdmin || s.permissions.has('hr.role.manage'))
  const notify = useUI(s => s.notify)
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<any[]>([])
  const [perms, setPerms] = useState<any[]>([])
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>({})
  const [editing, setEditing] = useState<any>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    const [{ data: rs }, { data: ps }, { data: rp }] = await Promise.all([
      supabase.from('roles').select('id,key,name,description,is_system').order('is_system', { ascending: false }),
      supabase.from('permissions').select('id,key,module,action,description'),
      supabase.from('role_permissions').select('role_id,permission_id')
    ])
    setRoles(rs ?? []); setPerms(ps ?? [])
    const m: Record<string, Set<string>> = {}
    ;(rp ?? []).forEach((r: any) => { (m[r.role_id] ??= new Set()).add(r.permission_id) })
    setRolePerms(m); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const modules = useMemo(() => Array.from(new Set(perms.map(p => p.module))).sort(), [perms])
  const permAt = (mod: string, act: string) => perms.find(p => p.module === mod && p.action === act)

  const openEdit = (r: any) => { setEditing(r); setSel(new Set(rolePerms[r.id] ?? [])) }
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleModule = (mod: string) => {
    const ids = perms.filter(p => p.module === mod).map(p => p.id)
    setSel(s => { const n = new Set(s); const all = ids.every(i => n.has(i)); ids.forEach(i => all ? n.delete(i) : n.add(i)); return n })
  }

  const columns = [
    { key: 'name', header: 'Role', accessor: (r: any) => r.name, sortable: true, className: 'font-medium' },
    { key: 'description', header: 'Description', accessor: (r: any) => r.description || '—' },
    { key: 'type', header: 'Type', render: (r: any) => <Badge tone={r.is_system ? 'neutral' : 'info'}>{r.is_system ? 'System' : 'Custom'}</Badge> },
    { key: 'perms', header: 'Permissions', className: 'text-right', accessor: (r: any) => String((rolePerms[r.id]?.size ?? 0)) },
    ...(canManage ? [{
      key: '__actions', header: '', className: 'w-px whitespace-nowrap', render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'tune', label: 'Edit access', onClick: () => openEdit(r) },
            ...(!r.is_system ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }] : [])
  ]

  const saveRole = async () => {
    if (!editing.name?.trim()) { notify('error', 'Role name required'); return }
    setBusy(true)
    try {
      let roleId = editing.id
      if (editing.__new) {
        const { data, error } = await supabase.from('roles').insert({ key: slug(editing.name), name: editing.name.trim(), description: editing.description || null, is_system: false }).select('id').single()
        if (error) throw error
        roleId = data.id
      } else if (!editing.is_system) {
        const { error } = await supabase.from('roles').update({ name: editing.name.trim(), description: editing.description || null }).eq('id', roleId)
        if (error) throw error
      }
      // Sync permissions atomically server-side. The old client-side delete+insert
      // was two round trips: a failed/blocked delete left the old rows in place and
      // the re-insert collided on role_permissions_pkey ("duplicate key"). One
      // race-safe RPC (which also enforces hr.role.manage) replaces the whole set.
      const { error: permErr } = await (supabase as any).rpc('set_role_permissions', {
        p_role_id: roleId, p_permission_ids: Array.from(sel)
      })
      if (permErr) throw permErr
      notify('success', `Role "${editing.name}" saved`); setEditing(null); load()
    } catch (e: any) { notify('error', e?.message ?? 'Could not save role') } finally { setBusy(false) }
  }

  if (loading) return <Spinner label="Loading…" />
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-soft">{roles.length} roles</span>
        {canManage && <Button className="ml-auto" icon="add" onClick={() => { setEditing({ __new: true, name: '', description: '' }); setSel(new Set()) }}>Add Role</Button>}
      </div>
      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={roles} rowKey={(r: any) => r.id} onRowClick={canManage ? openEdit : undefined} emptyTitle="No roles" />
      </Card>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.__new ? 'Add Role' : `Edit Role — ${editing.name}`} size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Role Name" required><Input value={editing.name ?? ''} disabled={editing.is_system} onChange={e => setEditing((x: any) => ({ ...x, name: e.target.value }))} placeholder="e.g. Dispatch Officer" /></Field>
              <Field label="Description"><Input value={editing.description ?? ''} disabled={editing.is_system} onChange={e => setEditing((x: any) => ({ ...x, description: e.target.value }))} /></Field>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Access — tick what this role can do</p>
              <div className="overflow-x-auto rounded-xl border border-surface-line">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-surface-line bg-surface-sunken text-left">
                      <th className="px-3 py-2 font-semibold text-ink-soft">Module</th>
                      {ACTIONS.map(a => <th key={a} className="px-2 py-2 text-center font-semibold capitalize text-ink-soft">{a}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map(mod => (
                      <tr key={mod} className="border-t border-surface-line/70">
                        <td className="px-3 py-1.5">
                          <button type="button" onClick={() => toggleModule(mod)} className="flex items-center gap-1 font-medium capitalize text-ink hover:text-brand-700">
                            <Icon name="done_all" className="text-[15px] text-ink-faint" /> {mod}
                          </button>
                        </td>
                        {ACTIONS.map(a => {
                          const p = permAt(mod, a)
                          return <td key={a} className="px-2 py-1.5 text-center">
                            {p ? <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 cursor-pointer accent-brand-500" /> : <span className="text-ink-faint">·</span>}
                          </td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[11px] text-ink-faint">{sel.size} permissions selected. Tip: click a module name to toggle its whole row.</p>
            </div>

            <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button icon="save" loading={busy} onClick={saveRole}>Save Role</Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)} name={deleting ? `Role · ${deleting.name}` : undefined}
        onConfirm={async () => {
          await supabase.from('role_permissions').delete().eq('role_id', deleting.id)
          const res = await supabase.from('roles').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); load() }
          return res
        }} />
    </div>
  )
}
