import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MODULES } from '@/lib/constants'
import { DOC_CONFIGS } from '@/features/inbound/docConfigs'
import { DocModule } from '@/features/inbound/components/DocModule'

const KEYS = ['sales-return', 'exchange', 'replacement']

export default function ReversePage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'reverse')!.tabs!
  const active = tab && KEYS.includes(tab) ? tab : 'sales-return'
  const config = DOC_CONFIGS[active]

  return (
    <div className="space-y-4">
      <PageHeader icon="undo" title="Reverse Logistics" subtitle="Sales return, exchange & replacement" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/reverse/${k}`)} />
      <DocModule key={active} config={config} />
    </div>
  )
}
