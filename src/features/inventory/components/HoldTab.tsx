import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { Field, Input } from '@/components/ui/Field'
import { SearchBar } from '@/components/shared/SearchBar'
import { Spinner } from '@/components/ui/States'
import { formatNumber } from '@/lib/utils'
import { STOCK_STATUS } from '@/lib/constants'

// Hold places part of a stock row's quantity into reserved_qty so it is no
// longer "available to pick"; release returns it. Held = reserved_qty.
export function HoldTab() {
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [onlyHeld, setOnlyHeld] = useState(false)
  const [action, setAction] = useState<{ row: any; hold: boolean } | null>(null)
  const canEdit = can('inventory.adjust')

  const load = () => {
    if (!currentClientId) return
    setLoading(true)
    supabase.from('inventory_stock')
      .select('*, products(name,material_code), warehouses(code), locations(location_code)')
      .eq('client_id', currentClientId).gt('quantity', 0)
      .then(({ data, error }) => {
        if (error) notify('error', `Could not load stock: ${error.message}`)
        setRows(data ?? []); setLoading(false)
      })
  }
  useEffect(load, [currentClientId])

  const filtered = useMemo(() => {
    let r = rows
    if (onlyHeld) r = r.filter(x => Number(x.reserved_qty) > 0)
    if (q.trim()) {
      const t = q.toLowerCase()
      r = r.filter(x => (x.products?.name ?? '').toLowerCase().includes(t) || (x.products?.material_code ?? '').toLowerCase().includes(t))
    }
    return r
  }, [rows, q, onlyHeld])

  const columns = [
    { key: 'code', header: 'Material Code', accessor: (r: any) => r.products?.material_code, sortable: true, className: 'font-medium' },
    { key: 'name', header: 'Product', accessor: (r: any) => r.products?.name },
    { key: 'wh', header: 'WH', accessor: (r: any) => r.warehouses?.code },
    { key: 'loc', header: 'Location', accessor: (r: any) => r.locations?.location_code ?? '—' },
    { key: 'status', header: 'Condition', render: (r: any) => <Badge tone={STOCK_STATUS[r.stock_status as keyof typeof STOCK_STATUS]?.tone}>{STOCK_STATUS[r.stock_status as keyof typeof STOCK_STATUS]?.label ?? r.stock_status}</Badge> },
    { key: 'qty', header: 'On Hand', accessor: (r: any) => r.quantity, className: 'text-right' },
    { key: 'held', header: 'Held', className: 'text-right', render: (r: any) => Number(r.reserved_qty) > 0 ? <span className="font-semibold text-horizon-critical">{formatNumber(r.reserved_qty)}</span> : '—' },
    { key: 'avail', header: 'Available', className: 'text-right font-medium', render: (r: any) => formatNumber(Number(r.quantity) - Number(r.reserved_qty ?? 0)) },
    ...(canEdit ? [{
      key: '__actions', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'lock', label: 'Hold', onClick: () => setAction({ row: r, hold: true }) },
            ...(Number(r.reserved_qty) > 0 ? [{ icon: 'lock_open', label: 'Release', onClick: () => setAction({ row: r, hold: false }) }] : [])
          ]} />
        </div>
      )
    }] : [])
  ]

  if (loading) return <Spinner label="Loading stock…" />
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search product…" /></div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={onlyHeld} onChange={e => setOnlyHeld(e.target.checked)} /> Held only
        </label>
        <span className="text-sm text-ink-soft">{filtered.length} records</span>
      </div>
      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={filtered} rowKey={(r: any) => r.id} emptyTitle="No stock records" />
      </Card>
      {action && <HoldModal action={action} onClose={() => setAction(null)} onDone={() => { setAction(null); load() }} />}
    </div>
  )
}

function HoldModal({ action, onClose, onDone }: { action: { row: any; hold: boolean }; onClose: () => void; onDone: () => void }) {
  const notify = useUI(s => s.notify)
  const { row, hold } = action
  const available = Number(row.quantity) - Number(row.reserved_qty ?? 0)
  const maxQty = hold ? available : Number(row.reserved_qty ?? 0)
  const [qty, setQty] = useState<string>(String(maxQty > 0 ? maxQty : ''))
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const n = Number(qty)
    if (!(n > 0)) { notify('error', 'Enter a positive quantity'); return }
    if (n > maxQty) { notify('error', `Cannot ${hold ? 'hold' : 'release'} more than ${formatNumber(maxQty)}`); return }
    setSaving(true)
    try {
      const { error } = await (supabase as any).rpc('adjust_stock_hold', { p_stock_id: row.id, p_qty: n, p_hold: hold })
      if (error) throw error
      notify('success', `${formatNumber(n)} ${hold ? 'placed on hold' : 'released'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not update hold')
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={hold ? 'Hold Stock' : 'Release Hold'}>
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          {row.products?.material_code} — {row.products?.name} · {row.warehouses?.code}
        </p>
        <div className="flex gap-4 text-sm">
          <span className="text-ink-faint">On hand: <span className="text-ink">{formatNumber(row.quantity)}</span></span>
          <span className="text-ink-faint">Held: <span className="text-ink">{formatNumber(row.reserved_qty ?? 0)}</span></span>
          <span className="text-ink-faint">Available: <span className="text-ink">{formatNumber(available)}</span></span>
        </div>
        <Field label={`Quantity to ${hold ? 'hold' : 'release'}`} required>
          <Input type="number" step="any" min={0} max={maxQty} value={qty} onChange={e => setQty(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon={hold ? 'lock' : 'lock_open'} loading={saving} onClick={submit}>{hold ? 'Hold' : 'Release'}</Button>
        </div>
      </div>
    </Modal>
  )
}
