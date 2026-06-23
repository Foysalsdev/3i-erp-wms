import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MODULES } from '@/lib/constants'
import { DOC_CONFIGS } from '../docConfigs'
import { DocModule } from '../components/DocModule'

const TAB_TO_CONFIG: Record<string, string> = {
  'purchase-order': 'purchase-order', 'grn': 'grn', 'putaway': 'putaway', 'purchase-return': 'purchase-return'
}

export default function InboundPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'inbound')!.tabs!
  const active = tab && TAB_TO_CONFIG[tab] ? tab : 'purchase-order'
  const config = DOC_CONFIGS[TAB_TO_CONFIG[active]]

  return (
    <div className="space-y-4">
      <PageHeader icon="login" title="Inbound Operations" subtitle="Purchase orders, goods receipt, putaway & purchase returns" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/inbound/${k}`)} />
      <DocModule key={active} config={config} />
    </div>
  )
}
