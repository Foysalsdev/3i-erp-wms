import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Spinner } from '@/components/ui/States'
import { SelectBox } from '@/components/ui/SelectBox'
import { formatNumber } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '../export'

import type { Tables } from '@/types/database.types'

type ProdInfo = Pick<Tables<'products'>, 'id' | 'category' | 'model' | 'material_code' | 'name'>
interface InvGroup { category: string; model: string; skus: Set<string>; total: number; good: number; damaged: number; quarantine: number; hold: number; reserved: number }
type InvRow = { category: string; model: string; skus: number; total: number; good: number; damaged: number; quarantine: number; hold: number; reserved: number; available: number } & Record<string, string | number>

const n = (v: number | string | null | undefined) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const COLORS = ['#1f3a93', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

// Stock summary grouped by Category + Model, with per-condition breakdown.
export function InventoryReport() {
  const { currentClientId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stock, setStock] = useState<Pick<Tables<'inventory_stock'>, 'product_id' | 'quantity' | 'reserved_qty' | 'stock_status'>[]>([])
  const [products, setProducts] = useState<Record<string, ProdInfo>>({})
  const [cat, setCat] = useState('')

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    Promise.all([
      supabase.from('inventory_stock').select('product_id,quantity,reserved_qty,stock_status').eq('client_id', currentClientId),
      supabase.from('products').select('id,category,model,material_code,name').eq('client_id', currentClientId)
    ]).then(([s, p]) => {
      setStock(s.data ?? [])
      const pm: Record<string, ProdInfo> = {}; (p.data ?? []).forEach(r => { pm[r.id] = r })
      setProducts(pm); setLoading(false)
    })
  }, [currentClientId])

  const categories = useMemo(() => Array.from(new Set(Object.values(products).map(p => p.category).filter((c): c is string => !!c))).sort(), [products])

  const rows = useMemo(() => {
    const agg: Record<string, InvGroup> = {}
    for (const r of stock) {
      const p = products[r.product_id]; if (!p) continue
      const category = p.category || '— Uncategorised'
      const model = p.model || '—'
      if (cat && category !== cat) continue
      const key = category + '||' + model
      const g = agg[key] ?? (agg[key] = { category, model, skus: new Set(), total: 0, good: 0, damaged: 0, quarantine: 0, hold: 0, reserved: 0 })
      g.skus.add(r.product_id)
      const q = n(r.quantity)
      g.total += q
      // per-condition buckets are keyed by stock_status ('good' | 'damaged' | ...)
      const bump = g as unknown as Record<string, number>
      if (typeof bump[r.stock_status] === 'number') bump[r.stock_status] += q
      g.reserved += n(r.reserved_qty)
    }
    return Object.values(agg).map((g): InvRow => ({ ...g, skus: g.skus.size, available: g.good - g.reserved }))
      .sort((a, b) => (a.category === b.category ? b.total - a.total : a.category.localeCompare(b.category)))
  }, [stock, products, cat])

  const cols: RepCol[] = [
    { key: 'category', header: 'Category', width: '20%' },
    { key: 'model', header: 'Model', width: '18%' },
    { key: 'skus', header: 'SKUs', align: 'right', width: '8%' },
    { key: 'total', header: 'Total Qty', align: 'right', width: '11%' },
    { key: 'good', header: 'Good', align: 'right', width: '9%' },
    { key: 'damaged', header: 'Damaged', align: 'right', width: '9%' },
    { key: 'quarantine', header: 'Quarantine', align: 'right', width: '9%' },
    { key: 'reserved', header: 'Reserved', align: 'right', width: '8%' },
    { key: 'available', header: 'Available', align: 'right', width: '9%' }
  ]
  const tableCols = cols.map(c => ({
    key: c.key, header: c.header, className: c.align === 'right' ? 'text-right' : '', sortable: true,
    accessor: (r: InvRow) => r[c.key],
    render: (r: InvRow) => ['category', 'model'].includes(c.key) ? r[c.key] : formatNumber(Number(r[c.key]))
  }))
  const byCat = useMemo(() => {
    const m: Record<string, number> = {}
    rows.forEach(r => { m[r.category] = (m[r.category] ?? 0) + r.total })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  }, [rows])

  if (loading) return <Spinner label="Loading…" />
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportToolbar count={rows.length} onCSV={() => downloadCSV('Inventory by Category-Model', cols, rows)} onPDF={() => downloadReportPDF('Inventory by Category & Model', 'Stock grouped by category and model', cols, rows)}>
        <div className="w-48"><SelectBox value={cat} onChange={e => setCat(e.target.value)}><option value="">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</SelectBox></div>
      </ReportToolbar>

      {byCat.length > 0 && (
        <Card className="p-3">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: { name?: string; value?: number }) => `${e.name}: ${formatNumber(e.value ?? 0)}`}>
                {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={tableCols} rows={rows} rowKey={r => r.category + '||' + r.model} emptyTitle="No stock yet" />
      </Card>
    </div>
  )
}
