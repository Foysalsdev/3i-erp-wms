import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MODULES } from '@/lib/constants'
import { InventoryDashboardTab } from '../components/InventoryDashboardTab'
import { StockTab } from '../components/StockTab'
import { LedgerTab } from '../components/LedgerTab'
import { SerialsTab } from '../components/SerialsTab'
import { SnapshotTab } from '../components/SnapshotTab'

export default function InventoryPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'inventory')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'dashboard'

  return (
    <div className="space-y-4">
      <PageHeader icon="warehouse" title="Inventory" subtitle="Stock, ledger, serials, snapshots & condition tracking" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/inventory/${k}`)} />
      {active === 'dashboard' && <InventoryDashboardTab />}
      {active === 'stock' && <StockTab title="Inventory Stock Report" />}
      {active === 'ledger' && <LedgerTab />}
      {active === 'snapshot' && <SnapshotTab />}
      {active === 'serials' && <SerialsTab />}
      {active === 'damaged' && <StockTab statusFilter="damaged" title="Damaged Stock Report" />}
      {active === 'quarantine' && <StockTab statusFilter="quarantine" title="Quarantine Stock Report" />}
    </div>
  )
}
