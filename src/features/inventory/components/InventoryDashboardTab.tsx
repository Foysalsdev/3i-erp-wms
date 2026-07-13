import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card, CardHeader } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { formatNumber } from '@/lib/utils'

export function InventoryDashboardTab() {
  const clientId = useAuth(s => s.currentClientId)
  const [loading, setLoading] = useState(true)
  const [agg, setAgg] = useState({ good: 0, damaged: 0, quarantine: 0 })
  const [low, setLow] = useState<any[]>([])

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    ;(async () => {
      const [{ data: stock }, { data: products }] = await Promise.all([
        supabase.from('inventory_stock').select('product_id,quantity,stock_status'),
        supabase.from('products').select('id,name,material_code,restock_level')
      ])
      const a = { good: 0, damaged: 0, quarantine: 0 }
      const per: Record<string, number> = {}
      ;(stock ?? []).forEach(s => { a[s.stock_status as keyof typeof a] += Number(s.quantity); per[s.product_id] = (per[s.product_id] ?? 0) + Number(s.quantity) })
      setAgg(a)
      setLow((products ?? []).map(p => ({ ...p, onhand: per[p.id] ?? 0 })).filter(p => p.onhand <= Number(p.restock_level)).slice(0, 10))
      setLoading(false)
    })()
  }, [clientId])

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[0, 1, 2].map(i => <CardSkeleton key={i} />)}</div>
      <TableSkeleton rows={6} cols={4} />
    </div>
  )
  const cards = [
    { label: 'Good Stock', val: agg.good, icon: 'check_circle', tone: 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400' },
    { label: 'Damaged', val: agg.damaged, icon: 'report', tone: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400' },
    { label: 'Quarantine', val: agg.quarantine, icon: 'pause_circle', tone: 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400' }
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(c => (
          <Card key={c.label} className="flex items-center gap-4 p-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-card ${c.tone}`}><Icon name={c.icon} className="text-[24px]" /></div>
            <div><p className="text-xs text-horizon-muted">{c.label}</p><p className="text-xl font-semibold">{formatNumber(c.val)}</p></div>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Low-Stock Alerts" subtitle="Items at or below re-stock level" />
        {low.length ? (
          <div className="divide-y divide-horizon-line">
            {low.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span><b>{p.material_code}</b> · {p.name}</span>
                <span className="flex items-center gap-2 text-horizon-muted">On hand {formatNumber(p.onhand)} / re-stock {formatNumber(p.restock_level)} <Badge tone="critical">Low</Badge></span>
              </div>
            ))}
          </div>
        ) : <EmptyState icon="task_alt" title="All items above re-stock level" />}
      </Card>
    </div>
  )
}
