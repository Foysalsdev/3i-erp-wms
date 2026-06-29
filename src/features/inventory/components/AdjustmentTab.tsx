import { useState } from 'react'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { StockAdjustModal } from './StockAdjustModal'
import { StockMovementHistory } from './StockMovementHistory'

// Manual stock adjustments — reuses the Post Stock Movement modal (defaulting to
// the ADJUST movement type) and lists the resulting adjustment ledger entries.
export function AdjustmentTab() {
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-soft">Manual stock corrections posted as ADJUST movements through the ledger.</span>
        {can('inventory.adjust') && <Button className="ml-auto" icon="add" onClick={() => setOpen(true)}>New Adjustment</Button>}
      </div>
      <StockMovementHistory key={reloadKey} movementTypes={['ADJUST']} emptyTitle="No adjustments recorded yet" />
      <StockAdjustModal open={open} onClose={() => setOpen(false)} onDone={() => { setOpen(false); setReloadKey(k => k + 1) }} />
    </div>
  )
}
