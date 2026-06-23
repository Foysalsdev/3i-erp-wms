import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MODULES } from '@/lib/constants'
import { DOC_CONFIGS } from '@/features/inbound/docConfigs'
import { DocModule } from '@/features/inbound/components/DocModule'

const KEYS = ['sales-order', 'picking', 'packing', 'delivery-challan', 'gate-pass']

export default function OutboundPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'outbound')!.tabs!
  const active = tab && KEYS.includes(tab) ? tab : 'sales-order'
  const config = DOC_CONFIGS[active]

  return (
    <div className="space-y-4">
      <PageHeader icon="logout" title="Outbound Operations" subtitle="Sales orders, picking, packing, delivery challan & gate pass" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/outbound/${k}`)} />
      <DocModule key={active} config={config} />
    </div>
  )
}
