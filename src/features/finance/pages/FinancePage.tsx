import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MODULES } from '@/lib/constants'
import { Requisitions } from '../Requisitions'
import { Expenses } from '../Expenses'
import { MonthlyAdjustment } from '../MonthlyAdjustment'

export default function FinancePage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'finance')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'requisition'

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader icon="payments" title="Finance" subtitle="Operating cost requisitions, fund tracking & expense" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/finance/${k}`)} />
      {active === 'requisition' ? <Requisitions /> : active === 'expense' ? <Expenses /> : <MonthlyAdjustment />}
    </div>
  )
}
