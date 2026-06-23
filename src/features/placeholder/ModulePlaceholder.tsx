import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { NavModule } from '@/lib/constants'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'

// Renders any of the 10 modules not yet implemented in this foundation build,
// with their real tab structure so the navigation is complete.
export function ModulePlaceholder({ module }: { module: NavModule }) {
  const { tab } = useParams()
  const nav = useNavigate()
  const [active, setActive] = useState(tab ?? module.tabs?.[0]?.key ?? 'main')
  return (
    <div className="space-y-4">
      <PageHeader icon={module.icon} title={module.label} subtitle="Module scaffold — tabs ready, business logic to be implemented" />
      {module.tabs && (
        <Tabs tabs={module.tabs} active={active}
          onChange={k => { setActive(k); nav(`${module.path}/${k}`) }} />
      )}
      <Card className="p-2">
        <EmptyState icon="construction" title={`${module.tabs?.find(t => t.key === active)?.label ?? module.label}`}
          hint="This tab follows the same pattern as the Masters and Inventory modules. Wire it to its Supabase tables and document workflows to activate." />
      </Card>
    </div>
  )
}
