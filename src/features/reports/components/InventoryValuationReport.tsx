import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Spinner } from '@/components/ui/States'
import { SearchBar } from '@/components/shared/SearchBar'
import { formatNumber } from '@/lib/utils'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '../export'

import type { Tables } from '@/types/database.types'

type ProdInfo = Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'category'>
type ValRow = { code: string; name: string; category: string; qty: number; cost: number; value: number }

const n = (v: number | string | null | undefined) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

// Inventory valuation: on-hand quantity × average purchase price (derived from
// goods receipt line prices, since products carry no standalone cost field).
export function InventoryValuationReport() {
  const { currentClientId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stock, setStock] = useState<Pick<Tables<'inventory_stock'>, 'product_id' | 'quantity' | 'stock_status'>[]>([])
  const [products, setProducts] = useState<Record<string, ProdInfo>>({})
  const [avgCost, setAvgCost] = useState<Record<string, number>>({})
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    Promise.all([
      supabase.from('inventory_stock').select('product_id,quantity,stock_status').eq('client_id', currentClientId),
      supabase.from('products').select('id,material_code,name,category').eq('client_id', currentClientId),
      supabase.from('goods_receipt_items').select('product_id,unit_price').eq('client_id', currentClientId)
    ]).then(([s, p, g]) => {
      setStock(s.data ?? [])
      const pm: Record<string, ProdInfo> = {}; (p.data ?? []).forEach(r => { pm[r.id] = r }); setProducts(pm)
      const sums: Record<string, { sum: number; cnt: number }> = {}
      ;(g.data ?? []).forEach(it => {
        const price = n(it.unit_price); if (price <= 0 || !it.product_id) return
        const e = sums[it.product_id] ?? (sums[it.product_id] = { sum: 0, cnt: 0 })
        e.sum += price; e.cnt += 1
      })
      const avg: Record<string, number> = {}
      Object.entries(sums).forEach(([id, v]) => { avg[id] = v.cnt ? v.sum / v.cnt : 0 })
      setAvgCost(avg); setLoading(false)
    })
  }, [currentClientId])

  const rows = useMemo(() => {
    const agg: Record<string, Omit<ValRow, 'cost' | 'value'>> = {}
    for (const r of stock) {
      const p = products[r.product_id]; if (!p) continue
      const g = agg[r.product_id] ?? (agg[r.product_id] = { code: p.material_code, name: p.name, category: p.category || '—', qty: 0 })
      g.qty += n(r.quantity)
    }
    return Object.entries(agg).map(([id, g]): ValRow => {
      const cost = avgCost[id] ?? 0
      return { ...g, cost, value: g.qty * cost }
    }).filter(r => r.qty !== 0).sort((a, b) => b.value - a.value)
  }, [stock, products, avgCost])

  const filteredRows = useMemo(() => {
    if (!q.trim()) return rows
    const t = q.toLowerCase()
    return rows.filter(r => r.code.toLowerCase().includes(t) || r.name.toLowerCase().includes(t) || r.category.toLowerCase().includes(t))
  }, [rows, q])

  const totalValue = useMemo(() => rows.reduce((s, r) => s + r.value, 0), [rows])

  const cols: RepCol[] = [
    { key: 'code', header: 'Material Code', width: '16%' },
    { key: 'name', header: 'Product', width: '34%' },
    { key: 'category', header: 'Category', width: '18%' },
    { key: 'qty', header: 'On Hand', align: 'right', width: '10%' },
    { key: 'cost', header: 'Avg Cost', align: 'right', width: '11%' },
    { key: 'value', header: 'Value', align: 'right', width: '11%' }
  ]
  const csvRows = useMemo(() => rows.map(r => ({ ...r, cost: r.cost.toFixed(2), value: r.value.toFixed(2) })), [rows])
  const tableCols: Column<ValRow>[] = [
    { key: 'code', header: 'Material Code', accessor: r => r.code, className: 'font-medium', sortable: true },
    { key: 'name', header: 'Product', accessor: r => r.name, sortable: true },
    { key: 'category', header: 'Category', accessor: r => r.category, sortable: true },
    { key: 'qty', header: 'On Hand', className: 'text-right', accessor: r => r.qty, render: r => formatNumber(r.qty), sortable: true },
    { key: 'cost', header: 'Avg Cost', className: 'text-right', accessor: r => r.cost, render: r => formatNumber(r.cost, 2), sortable: true },
    { key: 'value', header: 'Value', className: 'text-right font-medium', accessor: r => r.value, render: r => formatNumber(r.value, 2), sortable: true }
  ]

  if (loading) return <Spinner label="Valuing inventory…" />
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportToolbar count={filteredRows.length}
        onCSV={() => downloadCSV('Inventory Valuation', cols, csvRows)}
        onPDF={() => downloadReportPDF('Inventory Valuation Report', `Total value: ${formatNumber(totalValue, 2)}`, cols, csvRows)}>
        <div className="w-64"><SearchBar value={q} onChange={setQ} placeholder="Search code, product, category…" /></div>
      </ReportToolbar>
      <Card className="p-4">
        <p className="text-xs text-ink-faint">Total Inventory Value (avg purchase price)</p>
        <p className="mt-1 text-2xl font-bold text-ink">{formatNumber(totalValue, 2)}</p>
        <p className="mt-1 text-xs text-ink-faint">Products without any recorded purchase price are valued at 0.</p>
      </Card>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={tableCols} rows={filteredRows} rowKey={r => r.code} emptyTitle="No stock to value" />
      </Card>
    </div>
  )
}
