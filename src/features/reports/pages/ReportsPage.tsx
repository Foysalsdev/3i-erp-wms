import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { MODULES } from '@/lib/constants'
import { SalesReport } from '../components/SalesReport'
import { InventoryReport } from '../components/InventoryReport'
import { StockMovementReport } from '../components/StockMovementReport'
import { TransportReport } from '../components/TransportReport'

const REPORTS: Record<string, () => JSX.Element> = {
  outbound: SalesReport,
  inventory: InventoryReport,
  'stock-movement': StockMovementReport,
  transport: TransportReport
}

export default function ReportsPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'reports')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'outbound'
  const Report = REPORTS[active]
  const label = tabs.find(t => t.key === active)?.label ?? 'Report'

  return (
    <div className="space-y-4">
      <PageHeader icon="analytics" title="Reports & Analytics" subtitle="Sales, inventory, stock movement & dispatch — filter, view and export" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/reports/${k}`)} />
      {Report ? <Report /> : (
        <Card className="p-2">
          <EmptyState icon="construction" title={label}
            hint="This report is on the roadmap. The four core reports (Outbound Sales, Inventory, Stock Movement, Transport) are live now — pick one of those tabs." />
        </Card>
      )}
    </div>
  )
}
