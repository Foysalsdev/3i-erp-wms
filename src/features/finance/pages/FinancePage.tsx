import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { MODULES } from '@/lib/constants'
import { Requisitions } from '../Requisitions'
import { Expenses } from '../Expenses'
import { MonthlyAdjustment } from '../MonthlyAdjustment'
import { FinancialDashboard } from '../FinancialDashboard'

export default function FinancePage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'finance')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'requisition'
  const label = tabs.find(t => t.key === active)?.label ?? 'Finance'

  const content =
    active === 'requisition' ? <Requisitions /> :
    active === 'expense' ? <Expenses /> :
    active === 'monthly-adjustment' ? <MonthlyAdjustment /> :
    active === 'financial-dashboard' ? <FinancialDashboard /> : null

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader icon="payments" title="Finance" subtitle="Operating cost requisitions, fund tracking & expense" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/finance/${k}`)} />
      {content ?? (
        <Card className="p-2">
          <EmptyState icon="construction" title={label} hint="Not wired up yet — outside the current operating-cost workflow." />
        </Card>
      )}
    </div>
  )
}
