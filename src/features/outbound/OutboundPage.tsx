import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MODULES } from '@/lib/constants'
import { useAuth } from '@/store/auth'
import { OPERATIONS } from '@/features/operations/registry'
import { OperationList } from '@/features/operations/OperationList'
import { OutboundSalesOrders } from './OutboundSalesOrders'
import { SalesOrderApprovals } from './SalesOrderApprovals'
import { DeliveryChallan } from './DeliveryChallan'
import { DispatchBoard } from './DispatchBoard'

export default function OutboundPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const { can, isPlatformAdmin } = useAuth()
  // Salesman-type users (no warehouse/inventory access) only handle Sales Orders;
  // dispatch tabs (challan, gate pass, POD) are warehouse work.
  const dispatchAccess = isPlatformAdmin || can('inventory.view')
  // Approval is its own access, separate from dispatch/edit (e.g. Warehouse
  // Manager has outbound.approve but not inventory.view) — see
  // SalesOrderApprovals.tsx and the sales_orders_update RLS policy.
  const approvalAccess = isPlatformAdmin || can('outbound.approve')
  const allTabs = MODULES.find(m => m.key === 'outbound')!.tabs!
  const tabs = allTabs.filter(t =>
    t.key === 'sales-order' || (t.key === 'approvals' ? approvalAccess : dispatchAccess))
  const active = (tab && tabs.some(t => t.key === tab)) ? tab : 'sales-order'

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {dispatchAccess
        ? <PageHeader icon="logout" title="Outbound Operations" subtitle="Sales orders, picking, dispatch & delivery" />
        : <PageHeader icon="shopping_cart" title="Orders" subtitle="Raise an order request — warehouse takes it from here" />}
      {tabs.length > 1 && <Tabs tabs={tabs} active={active} onChange={k => nav(`/outbound/${k}`)} />}
      {active === 'sales-order' && <OutboundSalesOrders />}
      {active === 'approvals' && approvalAccess && <SalesOrderApprovals />}
      {active === 'board' && <DispatchBoard />}
      {active === 'delivery-challan' && <DeliveryChallan />}
      {active === 'gate-pass' && <OperationList def={OPERATIONS['gate-pass']} />}
      {active === 'pod-upload' && <OperationList def={OPERATIONS['pod-upload']} />}
    </div>
  )
}
