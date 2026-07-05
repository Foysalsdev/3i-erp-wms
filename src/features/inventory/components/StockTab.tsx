import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SearchBar } from '@/components/shared/SearchBar'
import { Spinner } from '@/components/ui/States'
import { formatNumber, formatDateTime } from '@/lib/utils'
import { STOCK_STATUS } from '@/lib/constants'
import { NON_SALEABLE, conditionLabel } from '@/lib/conditions'
import { movementLabel } from '@/lib/movements'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { StockAdjustModal } from './StockAdjustModal'
import type { StockRow } from '@/pdf/StockReportPDF'

// statusFilter: a single condition key, or 'nonsaleable' for everything that
// isn't sellable (replacement returns, box damage, parts removed, damaged,
// quarantine) — the pool the warehouse must keep visible and answerable.
export function StockTab({ statusFilter, title }: { statusFilter?: string; title: string }) {
  const { currentClientId, clients, can } = useAuth()
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cond, setCond] = useState<string | null>(null)   // chip filter within the view
  const [adjust, setAdjust] = useState(false)
  const [trail, setTrail] = useState<any | null>(null)    // row whose movement history is open
  const client = clients.find(c => c.id === currentClientId)
  const nonSaleableMode = statusFilter === 'nonsaleable'

  const load = () => {
    if (!currentClientId) return
    setLoading(true)
    let query = supabase.from('inventory_stock')
      .select('*, products(name,material_code,restock_level), warehouses(name,code), locations(location_code)')
      .eq('client_id', currentClientId)
    if (nonSaleableMode) query = query.neq('stock_status', 'good').gt('quantity', 0)
    else if (statusFilter) query = query.eq('stock_status', statusFilter)
    query.then(({ data, error }) => {
      if (error) notify('error', `Could not load stock: ${error.message}`)
      setRows(data ?? []); setLoading(false)
    })
  }
  useEffect(load, [currentClientId, statusFilter])

  // Per-condition subtotals for the chip strip (non-saleable view).
  const condTotals = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach(r => m.set(r.stock_status, (m.get(r.stock_status) ?? 0) + Number(r.quantity || 0)))
    return m
  }, [rows])

  const filtered = useMemo(() => {
    let list = rows
    if (cond) list = list.filter(r => r.stock_status === cond)
    if (!q.trim()) return list
    const t = q.toLowerCase()
    return list.filter(r => (r.products?.name ?? '').toLowerCase().includes(t) || (r.products?.material_code ?? '').toLowerCase().includes(t))
  }, [rows, q, cond])

  const columns = [
    { key: 'code', header: 'Material Code', accessor: (r: any) => r.products?.material_code, sortable: true, className: 'font-medium' },
    { key: 'name', header: 'Product', accessor: (r: any) => r.products?.name, sortable: true },
    { key: 'wh', header: 'Warehouse', accessor: (r: any) => r.warehouses?.code },
    { key: 'loc', header: 'Location', accessor: (r: any) => r.locations?.location_code ?? '—' },
    { key: 'status', header: 'Condition', render: (r: any) => <Badge tone={STOCK_STATUS[r.stock_status as keyof typeof STOCK_STATUS]?.tone}>{STOCK_STATUS[r.stock_status as keyof typeof STOCK_STATUS]?.label ?? r.stock_status}</Badge> },
    { key: 'qty', header: 'On Hand', accessor: (r: any) => r.quantity, sortable: true, className: 'text-right font-medium',
      render: (r: any) => <span className={Number(r.quantity) <= Number(r.products?.restock_level ?? 0) ? 'text-horizon-critical font-semibold' : ''}>{formatNumber(r.quantity)}</span> },
    { key: 'reserved', header: 'Reserved', accessor: (r: any) => r.reserved_qty, className: 'text-right' }
  ]

  // No raw stock-row deletes (even for admins): removing a row silently
  // diverges on-hand from the ledger. Zero a row out with an ADJUST movement
  // instead — that keeps the audit trail consistent.
  const exportPDF = async () => {
    try {
      const data: StockRow[] = filtered.map(r => ({
        code: r.products?.material_code ?? '', name: r.products?.name ?? '', warehouse: r.warehouses?.code ?? '',
        status: r.stock_status, qty: Number(r.quantity)
      }))
      const { downloadStockPDF } = await import('@/pdf/StockReportPDF')
      await downloadStockPDF(client?.name ?? '', data, title)
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate PDF')
    }
  }

  if (loading) return <Spinner label="Loading stock…" />
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search product…" /></div>
        <span className="text-sm text-horizon-muted">{filtered.length} records</span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon="picture_as_pdf" onClick={exportPDF}>PDF</Button>
          {can('inventory.adjust') && <Button icon="add" onClick={() => setAdjust(true)}>Post Movement</Button>}
        </div>
      </div>
      {nonSaleableMode && (
        // One chip per non-saleable condition with its on-hand total — tap to
        // drill into just that pool.
        <div className="flex flex-wrap gap-1.5">
          {NON_SALEABLE.map(c => {
            const total = condTotals.get(c.key) ?? 0
            if (total === 0 && cond !== c.key) return null
            return (
              <button key={c.key} type="button" title={c.hint} onClick={() => setCond(k => k === c.key ? null : c.key)}
                className={'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ' +
                  (cond === c.key ? 'border-brand-400 bg-brand-500/10 text-brand-700' : 'border-surface-line text-ink-soft hover:bg-surface-sunken')}>
                <Icon name={c.icon} className="text-[14px]" /> {c.label}
                <span className="tabular-nums text-ink">{formatNumber(total)}</span>
              </button>
            )
          })}
          {rows.length === 0 && <span className="text-sm text-ink-faint">Non-saleable pool is empty — everything in the warehouse is fresh.</span>}
        </div>
      )}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={filtered} rowKey={(r: any) => r.id}
          onRowClick={r => setTrail(r)} emptyTitle="No stock records" />
      </Card>
      <StockAdjustModal open={adjust} onClose={() => setAdjust(false)} onDone={() => { setAdjust(false); load() }} />
      {trail && <StockTrailModal row={trail} clientId={currentClientId!} onClose={() => setTrail(null)} />}
    </div>
  )
}

// Answers "where did this pool come from, why, on what document" for one
// product+warehouse+condition: its slice of inventory_ledger, newest first —
// every entry carries the movement kind, the document reference and the reason.
function StockTrailModal({ row, clientId, onClose }: { row: any; clientId: string; onClose: () => void }) {
  const [entries, setEntries] = useState<any[] | null>(null)
  useEffect(() => {
    supabase.from('inventory_ledger')
      .select('id,created_at,movement_type,qty_in,qty_out,balance_after,reference_no,remarks')
      .eq('client_id', clientId).eq('product_id', row.product_id).eq('warehouse_id', row.warehouse_id)
      .eq('stock_status', row.stock_status)
      .order('created_at', { ascending: false }).limit(60)
      .then(({ data }) => setEntries(data ?? []))
  }, [row, clientId])

  return (
    <Modal open onClose={onClose} size="lg"
      title={`${row.products?.material_code ?? ''} · ${conditionLabel(row.stock_status)} — history`}>
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          {row.products?.name} · {row.warehouses?.code} — on hand <b className="text-ink">{formatNumber(row.quantity)}</b>.
          Every movement below carries its document reference and reason.
        </p>
        {!entries ? <p className="py-6 text-center text-sm text-ink-faint">Loading history…</p> :
          entries.length === 0 ? <p className="py-6 text-center text-sm text-ink-faint">No recorded movements for this pool.</p> : (
            <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-surface-line">
              {entries.map((e: any, i: number) => (
                <div key={e.id} className={'px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line/70' : '')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge tone="info">{movementLabel(e.movement_type)}</Badge>
                      <span className="truncate font-mono text-xs text-ink-soft">{e.reference_no ?? '—'}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {Number(e.qty_in) > 0 && <span className="font-semibold text-ok">+{formatNumber(e.qty_in)}</span>}
                      {Number(e.qty_out) > 0 && <span className="font-semibold text-bad">−{formatNumber(e.qty_out)}</span>}
                      <span className="ml-2 text-xs text-ink-faint">bal {formatNumber(e.balance_after)}</span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-faint">{formatDateTime(e.created_at)}{e.remarks ? ` · ${e.remarks}` : ''}</p>
                </div>
              ))}
            </div>
          )}
      </div>
    </Modal>
  )
}
