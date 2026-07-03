import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MODULES } from '@/lib/constants'
import { OPERATIONS } from '@/features/operations/registry'
import { OperationList } from '@/features/operations/OperationList'
import { InboundPurchaseRequisitions } from './InboundPurchaseRequisitions'
import { InboundGRN } from './InboundGRN'
import { ReceiveTab } from './ReceiveWizard'

export default function InboundPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'inbound')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'receive'

  return (
    <div className="space-y-4">
      <PageHeader icon="login" title="Inbound Operations" subtitle="Receive, requisitions, goods receipt, putaway & returns" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/inbound/${k}`)} />
      {active === 'receive' && <ReceiveTab />}
      {active === 'purchase-requisition' && <InboundPurchaseRequisitions />}
      {active === 'grn' && <InboundGRN />}
      {active === 'putaway' && <OperationList def={OPERATIONS.putaway} />}
      {active === 'purchase-return' && <OperationList def={OPERATIONS['purchase-return']} />}
      {active === 'supplier-invoice' && <OperationList def={OPERATIONS['supplier-invoice']} />}
    </div>
  )
}
