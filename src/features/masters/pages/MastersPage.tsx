import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MASTERS, MASTER_ORDER } from '../registry'
import { MasterList } from '../components/MasterList'

export default function MastersPage() {
  const { entity } = useParams()
  const nav = useNavigate()
  const active = entity && MASTERS[entity] ? entity : MASTER_ORDER[0]
  const def = MASTERS[active]
  const tabs = MASTER_ORDER.map(k => ({ key: k, label: MASTERS[k].singular }))

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader icon="inventory_2" title="Masters" subtitle="Central master data — list, card & profile views with attachments, notes & activity" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/masters/${k}`)} />
      <MasterList key={active} def={def} />
    </div>
  )
}
