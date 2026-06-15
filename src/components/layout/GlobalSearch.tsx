import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Icon } from '@/components/ui/Icon'

interface Hit { module: string; icon: string; label: string; sub: string; path: string }

// Global search spans the core modules for the active client (RLS-scoped).
const SOURCES = [
  { table: 'products', icon: 'inventory_2', label: 'name', sub: 'material_code', cols: 'id,name,material_code', path: '/masters/products' },
  { table: 'customers', icon: 'badge', label: 'name', sub: 'customer_code', cols: 'id,name,customer_code', path: '/masters/customers' },
  { table: 'suppliers', icon: 'local_shipping', label: 'name', sub: 'supplier_code', cols: 'id,name,supplier_code', path: '/masters/suppliers' },
  { table: 'warehouses', icon: 'warehouse', label: 'name', sub: 'code', cols: 'id,name,code', path: '/masters/warehouses' },
  { table: 'assets', icon: 'category', label: 'name', sub: 'asset_code', cols: 'id,name,asset_code', path: '/masters/assets' }
] as const

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const clientId = useAuth(s => s.currentClientId)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (!open) { setQ(''); setHits([]) }
  }, [open])

  useEffect(() => {
    if (!q.trim() || !clientId) { setHits([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const results = await Promise.all(SOURCES.map(async s => {
        const labelCol = s.label as string, subCol = s.sub as string
        const { data } = await supabase.from(s.table as any).select(s.cols)
          .eq('client_id', clientId)
          .or(`${labelCol}.ilike.%${q}%,${subCol}.ilike.%${q}%`).limit(5)
        return (data ?? []).map((r: any) => ({
          module: s.table, icon: s.icon, label: r[labelCol], sub: r[subCol], path: s.path
        })) as Hit[]
      }))
      setHits(results.flat()); setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [q, clientId])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-card bg-surface shadow-fiori-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-horizon-line px-4">
          <Icon name="search" className="text-slate-400" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search products, customers, suppliers, warehouses, assets…"
            className="w-full py-3.5 text-sm outline-none" />
          {loading && <Icon name="progress_activity" className="animate-spin text-brand-500" />}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {hits.length === 0 && q && !loading && <p className="px-3 py-6 text-center text-sm text-horizon-muted">No matches</p>}
          {hits.map((h, i) => (
            <button key={i} onClick={() => { nav(h.path); onClose() }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-brand-50/60">
              <Icon name={h.icon} className="text-[20px] text-brand-500" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{h.label}</p>
                <p className="truncate text-xs text-horizon-muted">{h.module} · {h.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
