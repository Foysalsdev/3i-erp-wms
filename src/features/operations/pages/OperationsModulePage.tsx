import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { MODULES, type NavModule } from '@/lib/constants'
import { OPERATIONS } from '../registry'
import { OperationList } from '../OperationList'

// Renders an operational module (Inbound / Outbound / Transport / Finance):
// its tabs are wired to live OperationList registers where implemented, and
// fall back to a scaffold state for tabs not yet built.
export function OperationsModulePage({ moduleKey }: { moduleKey: string }) {
  const module = MODULES.find(m => m.key === moduleKey) as NavModule
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = module.tabs ?? []
  const active = tab && tabs.some(t => t.key === tab) ? tab : tabs[0]?.key ?? ''
  const def = OPERATIONS[active]
  const tabLabel = tabs.find(t => t.key === active)?.label ?? module.label

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader icon={module.icon} title={module.label} subtitle="Operational documents with status workflow" />
      {tabs.length > 0 && <Tabs tabs={tabs} active={active} onChange={k => nav(`${module.path}/${k}`)} />}
      {def && def.module === moduleKey ? (
        <OperationList key={active} def={def} />
      ) : (
        <Card className="p-2">
          <EmptyState icon="construction" title={tabLabel}
            hint="This tab follows the same pattern as the implemented registers. Wire it to its Supabase table and document workflow to activate." />
        </Card>
      )}
    </div>
  )
}
