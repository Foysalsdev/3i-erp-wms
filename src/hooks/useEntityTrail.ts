import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/store/ui'

// ---------------------------------------------------------------------------
// Entity Trail (docs/TRACKING-ARCHITECTURE.md §3.2, Phase 1: frontend-derived,
// zero schema risk). Merges the two existing sources of truth into one
// chronological trail for a document:
//   - audit_logs   -> what changed on the document itself (status, fields)
//   - inventory_ledger -> what actually moved in/out of stock because of it
// so "what happened to this GRN/challan" is one panel, not two screens.
// ---------------------------------------------------------------------------

export interface TrailEvent {
  id: string
  at: string
  by: string | null
  kind: 'audit' | 'ledger'
  // audit
  action?: 'INSERT' | 'UPDATE' | 'DELETE'
  changes?: { field: string; from: any; to: any }[]
  status?: string | null
  // ledger
  movementType?: string
  qtyIn?: number
  qtyOut?: number
  balanceAfter?: number
  warehouseCode?: string
  productLabel?: string
}

const SKIP = new Set(['updated_at', 'created_at', 'id', 'client_id', 'created_by', 'posted_at'])

function diff(oldData: any, newData: any): { field: string; from: any; to: any }[] {
  if (!oldData || !newData) return []
  const out: { field: string; from: any; to: any }[] = []
  for (const k of Object.keys(newData)) {
    if (SKIP.has(k)) continue
    const a = oldData[k], b = newData[k]
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: k, from: a, to: b })
  }
  return out
}

// `referenceNo` matches inventory_ledger.reference_no (the document number
// that post_stock_movement was called with) — pass undefined to skip the
// ledger leg entirely for documents that never move stock (e.g. a PR).
export function useEntityTrail(table: string, recordId?: string, referenceNo?: string | null) {
  const notify = useUI(s => s.notify)
  const [events, setEvents] = useState<TrailEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!recordId) return
    let active = true
    setLoading(true)
    Promise.all([
      supabase.from('audit_logs').select('*').eq('table_name', table).eq('record_id', recordId)
        .order('changed_at', { ascending: false }).limit(50),
      referenceNo
        ? supabase.from('inventory_ledger').select('*, products(name,material_code), warehouses(code)')
            .eq('reference_no', referenceNo).order('created_at', { ascending: false }).limit(50)
        : Promise.resolve({ data: [], error: null })
    ]).then(async ([auditRes, ledgerRes]) => {
      if (!active) return
      if (auditRes.error) notify('error', `Could not load activity: ${auditRes.error.message}`)
      if (ledgerRes.error) notify('error', `Could not load stock movements: ${ledgerRes.error.message}`)

      const userIds = new Set<string>()
      ;(auditRes.data ?? []).forEach((r: any) => { if (r.changed_by) userIds.add(r.changed_by) })
      ;(ledgerRes.data ?? []).forEach((r: any) => { if (r.created_by) userIds.add(r.created_by) })
      const { data: profiles } = userIds.size
        ? await supabase.from('profiles').select('id,full_name').in('id', [...userIds])
        : { data: [] as any[] }
      const nameOf = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))

      const auditEvents: TrailEvent[] = (auditRes.data ?? []).map((e: any) => ({
        id: `a-${e.id}`, at: e.changed_at, by: nameOf[e.changed_by] ?? null, kind: 'audit',
        action: e.action, status: e.new_data?.status ?? null,
        changes: e.action === 'UPDATE' ? diff(e.old_data, e.new_data) : []
      }))
      const ledgerEvents: TrailEvent[] = (ledgerRes.data ?? []).map((r: any) => ({
        id: `l-${r.id}`, at: r.created_at, by: nameOf[r.created_by] ?? null, kind: 'ledger',
        movementType: r.movement_type, qtyIn: Number(r.qty_in) || 0, qtyOut: Number(r.qty_out) || 0,
        balanceAfter: Number(r.balance_after), warehouseCode: r.warehouses?.code,
        productLabel: r.products ? `${r.products.material_code} — ${r.products.name}` : undefined
      }))

      setEvents([...auditEvents, ...ledgerEvents].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()))
      setLoading(false)
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, recordId, referenceNo])

  return { events, loading }
}
