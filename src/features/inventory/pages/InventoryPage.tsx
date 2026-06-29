import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { MODULES } from '@/lib/constants'
import { StockTab } from '../components/StockTab'
import { LedgerTab } from '../components/LedgerTab'
import { SerialsTab } from '../components/SerialsTab'
import { AdjustmentTab } from '../components/AdjustmentTab'
import { TransferTab } from '../components/TransferTab'
import { HoldTab } from '../components/HoldTab'
import { CountTab } from '../components/CountTab'

const IMPLEMENTED = ['stock', 'ledger', 'serials', 'damaged', 'quarantine', 'transfer', 'adjustment', 'cycle-count', 'physical-verification', 'hold']

export default function InventoryPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'inventory')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'stock'
  const label = tabs.find(t => t.key === active)?.label ?? 'Inventory'

  return (
    <div className="space-y-4">
      <PageHeader icon="warehouse" title="Inventory Management" subtitle="Stock, movements, transfers, counts, holds & serials" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/inventory/${k}`)} />
      {active === 'stock' && <StockTab title="Stock Overview" />}
      {active === 'ledger' && <LedgerTab />}
      {active === 'serials' && <SerialsTab />}
      {active === 'damaged' && <StockTab statusFilter="damaged" title="Damaged Stock Report" />}
      {active === 'quarantine' && <StockTab statusFilter="quarantine" title="Quarantine Stock Report" />}
      {active === 'transfer' && <TransferTab />}
      {active === 'adjustment' && <AdjustmentTab />}
      {active === 'hold' && <HoldTab />}
      {active === 'cycle-count' && <CountTab countType="cycle" title="Cycle Counts" singular="Cycle Count" />}
      {active === 'physical-verification' && <CountTab countType="physical" title="Physical Verifications" singular="Physical Verification" />}
      {!IMPLEMENTED.includes(active) && (
        <Card className="p-2">
          <EmptyState icon="construction" title={label}
            hint="Lot/Batch tracking, FIFO and FEFO need batch & expiry attributes on stock — being scoped next." />
        </Card>
      )}
    </div>
  )
}
