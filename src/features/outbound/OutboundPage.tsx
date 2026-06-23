import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MODULES } from '@/lib/constants'
import { OPERATIONS } from '@/features/operations/registry'
import { OperationList } from '@/features/operations/OperationList'
import { OutboundSalesOrders } from './OutboundSalesOrders'
import { DeliveryChallan } from './DeliveryChallan'

export default function OutboundPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'outbound')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'sales-order'

  return (
    <div className="space-y-4">
      <PageHeader icon="logout" title="Outbound Operations" subtitle="Sales orders, picking, dispatch & delivery" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/outbound/${k}`)} />
      {active === 'sales-order' && <OutboundSalesOrders />}
      {active === 'delivery-challan' && <DeliveryChallan />}
      {active === 'gate-pass' && <OperationList def={OPERATIONS['gate-pass']} />}
      {active === 'pod-upload' && <OperationList def={OPERATIONS['pod-upload']} />}
    </div>
  )
}
