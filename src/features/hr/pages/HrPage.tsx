import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { MODULES } from '@/lib/constants'
import { UserManagement } from '../UserManagement'
import { RoleManagement } from '../RoleManagement'

export default function HrPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'hr')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'users'
  const label = tabs.find(t => t.key === active)?.label ?? 'HR'

  return (
    <div className="space-y-4">
      <PageHeader icon="groups" title="HR & Administration" subtitle="Users, roles, designation & division" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/hr/${k}`)} />
      {active === 'users' ? <UserManagement /> : active === 'roles' ? <RoleManagement /> : (
        <Card className="p-2">
          <EmptyState icon="construction" title={label}
            hint={active === 'employee' ? 'Employee records live under Masters → Employee. User Management (login users with role/designation/division) is ready in the Users tab.' : 'On the roadmap. User Management is live in the Users tab.'} />
        </Card>
      )}
    </div>
  )
}
