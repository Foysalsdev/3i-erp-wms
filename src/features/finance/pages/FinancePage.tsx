import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MODULES } from '@/lib/constants'
import { FinanceDashboard } from '../FinanceDashboard'
import { Requisitions } from '../Requisitions'
import { Expenses } from '../Expenses'
import { MonthlyAdjustment } from '../MonthlyAdjustment'
import { FinanceSetup } from '../FinanceSetup'
import { VendorDues } from '../VendorDues'

export default function FinancePage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'finance')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'dashboard'

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader icon="payments" title="Finance" subtitle="Warehouse fund, requisitions, procurement & cash book" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/finance/${k}`)} />
      {active === 'dashboard' ? <FinanceDashboard />
        : active === 'requisition' ? <Requisitions />
        : active === 'voucher' ? <Expenses />
        : active === 'cash-book' ? <MonthlyAdjustment />
        : active === 'dues' ? <VendorDues />
        : <FinanceSetup />}
    </div>
  )
}
