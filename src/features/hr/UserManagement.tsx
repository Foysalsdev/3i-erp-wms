import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { SearchBar } from '@/components/shared/SearchBar'
import { Spinner } from '@/components/ui/States'

// Manage login users: set each user's Role, Designation and Division.
// (Creating brand-new login accounts comes later, under Settings.)
export function UserManagement() {
  const { currentClientId, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [userRoles, setUserRoles] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    const [{ data: profs }, { data: rs }, { data: ur }] = await Promise.all([
      supabase.from('profiles').select('id,full_name,email,designation,division,status,is_platform_admin'),
      supabase.from('roles').select('id,name,key'),
      supabase.from('user_roles').select('user_id,role_id').eq('client_id', currentClientId!)
    ])
    setUsers(profs ?? []); setRoles(rs ?? [])
    const m: Record<string, string> = {}; (ur ?? []).forEach((r: any) => { m[r.user_id] = r.role_id })
    setUserRoles(m); setLoading(false)
  }
  useEffect(() => { if (currentClientId) load() /* eslint-disable-next-line */ }, [currentClientId])

  const roleName = (uid: string) => roles.find(r => r.id === userRoles[uid])?.name ?? '—'
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return users.filter(u => !t || (u.full_name ?? '').toLowerCase().includes(t) || (u.email ?? '').toLowerCase().includes(t) || (u.division ?? '').toLowerCase().includes(t))
  }, [users, q])

  const columns = [
    { key: 'name', header: 'Name', accessor: (r: any) => r.full_name || '—', sortable: true, className: 'font-medium' },
    { key: 'email', header: 'Email', accessor: (r: any) => r.email },
    { key: 'designation', header: 'Designation', accessor: (r: any) => r.designation || '—' },
    { key: 'division', header: 'Division', accessor: (r: any) => r.division || '—' },
    { key: 'role', header: 'Role', render: (r: any) => <Badge tone={r.is_platform_admin ? 'positive' : 'info'}>{r.is_platform_admin ? 'Platform Admin' : roleName(r.id)}</Badge> },
    ...(isPlatformAdmin ? [{
      key: '__actions', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => <div className="flex justify-end" onClick={e => e.stopPropagation()}><ActionMenu items={[{ icon: 'edit', label: 'Edit', onClick: () => setEditing({ ...r, role_id: userRoles[r.id] ?? '' }) }]} /></div>
    }] : [])
  ]

  if (loading) return <Spinner label="Loading…" />
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search name / email / division…" /></div>
        <span className="text-sm text-ink-soft">{rows.length} users</span>
        {!isPlatformAdmin && <span className="ml-auto text-xs text-ink-faint">Only an admin can edit other users.</span>}
      </div>
      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={rows} rowKey={(r: any) => r.id} emptyTitle="No users yet" />
      </Card>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={`Edit User — ${editing.full_name || editing.email}`} size="md">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Designation"><Input value={editing.designation ?? ''} onChange={e => setEditing((x: any) => ({ ...x, designation: e.target.value }))} placeholder="e.g. Sales Officer" /></Field>
              <Field label="Division"><Input value={editing.division ?? ''} onChange={e => setEditing((x: any) => ({ ...x, division: e.target.value }))} placeholder="e.g. Dhaka" /></Field>
              <Field label="Role" className="sm:col-span-2">
                <Select value={editing.role_id ?? ''} onChange={e => setEditing((x: any) => ({ ...x, role_id: e.target.value }))} disabled={editing.is_platform_admin}>
                  <option value="">— No role —</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </Field>
            </div>
            {editing.is_platform_admin && <p className="text-xs text-ink-faint">This user is a Platform Admin — role is fixed.</p>}
            <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button icon="save" onClick={async () => {
                const { error } = await (supabase as any).from('profiles').update({ designation: editing.designation || null, division: editing.division || null }).eq('id', editing.id)
                if (error) { notify('error', error.message); return }
                if (!editing.is_platform_admin) {
                  await supabase.from('user_roles').delete().eq('client_id', currentClientId!).eq('user_id', editing.id)
                  if (editing.role_id) {
                    const { error: re } = await supabase.from('user_roles').insert({ client_id: currentClientId!, user_id: editing.id, role_id: editing.role_id })
                    if (re) { notify('error', re.message); return }
                  }
                }
                notify('success', 'User updated'); setEditing(null); load()
              }}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
