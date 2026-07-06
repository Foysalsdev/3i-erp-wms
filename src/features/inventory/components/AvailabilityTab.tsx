import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/shared/SearchBar'
import { Spinner } from '@/components/ui/States'
import { formatNumber } from '@/lib/utils'
import { fetchStockAvailability, type StockAvailability } from '@/lib/stockAvailability'

// Available-to-promise, one row per product: what Sales can safely quote
// (Saleable) next to every reason the rest of the on-hand quantity isn't
// free — held, committed to an open order not yet invoiced, invoiced but
// not yet delivered, or sitting in the non-saleable condition pool. Total
// always equals the sum of the other columns.
export function AvailabilityTab() {
  const { currentClientId } = useAuth()
  const [rows, setRows] = useState<(StockAvailability & { productId: string; code: string; name: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [shortOnly, setShortOnly] = useState(false)

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    ;(async () => {
      const [avail, { data: products }] = await Promise.all([
        fetchStockAvailability(currentClientId),
        supabase.from('products').select('id,material_code,name').eq('client_id', currentClientId)
      ])
      setRows((products ?? [])
        .map((p: any) => ({ productId: p.id, code: p.material_code, name: p.name, ...(avail[p.id] ?? { total: 0, good: 0, nonSaleable: 0, held: 0, pendingInvoice: 0, pendingDelivery: 0, saleable: 0 }) }))
        .filter(r => r.total > 0))
      setLoading(false)
    })()
  }, [currentClientId])

  const filtered = useMemo(() => {
    let list = rows
    if (shortOnly) list = list.filter(r => r.saleable <= 0)
    if (!q.trim()) return list
    const t = q.toLowerCase()
    return list.filter(r => r.code.toLowerCase().includes(t) || r.name.toLowerCase().includes(t))
  }, [rows, q, shortOnly])

  const columns = [
    { key: 'code', header: 'Material Code', accessor: (r: any) => r.code, sortable: true, className: 'font-medium' },
    { key: 'name', header: 'Product', accessor: (r: any) => r.name, sortable: true },
    { key: 'total', header: 'Total On Hand', accessor: (r: any) => r.total, className: 'text-right', render: (r: any) => formatNumber(r.total), sortable: true },
    { key: 'saleable', header: 'Saleable', accessor: (r: any) => r.saleable, className: 'text-right', sortable: true,
      render: (r: any) => <span className={r.saleable <= 0 ? 'font-semibold text-bad' : 'font-semibold text-ok'}>{formatNumber(r.saleable)}</span> },
    { key: 'held', header: 'Held', className: 'text-right', render: (r: any) => r.held > 0 ? formatNumber(r.held) : '—' },
    { key: 'pendingInvoice', header: 'Pending Invoice', className: 'text-right', render: (r: any) => r.pendingInvoice > 0 ? formatNumber(r.pendingInvoice) : '—' },
    { key: 'pendingDelivery', header: 'Pending Delivery', className: 'text-right', render: (r: any) => r.pendingDelivery > 0 ? formatNumber(r.pendingDelivery) : '—' },
    { key: 'nonSaleable', header: 'Non-Saleable', className: 'text-right', render: (r: any) => r.nonSaleable > 0 ? formatNumber(r.nonSaleable) : '—' }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search product…" /></div>
        <button type="button" onClick={() => setShortOnly(v => !v)}
          className={'rounded-lg border px-2.5 py-1.5 text-xs font-semibold ' +
            (shortOnly ? 'border-bad/40 bg-bad/10 text-bad' : 'border-surface-line text-ink-soft hover:bg-surface-sunken')}>
          Nothing saleable only
        </button>
        <span className="text-sm text-ink-soft">{filtered.length} products</span>
      </div>
      <p className="text-xs text-ink-faint">
        <b>Saleable</b> is what's actually free to quote on a new order — on-hand stock minus manual holds and
        everything already committed to an open sales order (<b>Pending Invoice</b>: approved/picking/packed;
        <b> Pending Delivery</b>: invoiced/dispatched but not yet fully delivered). <b>Total</b> only drops once
        a delivery challan is issued.
      </p>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading ? <Spinner label="Loading availability…" /> : (
          <DataTable fill columns={columns} rows={filtered} rowKey={(r: any) => r.productId} emptyTitle="No stock on hand" />
        )}
      </Card>
    </div>
  )
}
