import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/States'

// Per-category rate card for one courier. Couriers charge per piece and the
// price differs by product size class (category); a blank rate means the
// courier's flat Rate/Unit fallback applies for that category.
export function CourierRatesPanel({ courierId }: { courierId: string }) {
  const { currentClientId, can } = useAuth()
  const canEdit = can('masters.edit') || can('masters.create')
  const notify = useUI(s => s.notify)
  const [cats, setCats] = useState<string[]>([])
  const [rates, setRates] = useState<Record<string, string>>({})
  const [initial, setInitial] = useState<Record<string, string>>({})
  const [fallback, setFallback] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentClientId || !courierId) return
    setLoading(true)
    Promise.all([
      supabase.from('products').select('category').eq('client_id', currentClientId),
      supabase.from('courier_rates').select('category,rate').eq('courier_id', courierId),
      supabase.from('couriers').select('rate_per_unit').eq('id', courierId).single()
    ]).then(([prods, rr, c]) => {
      const set = new Set<string>()
      ;(prods.data ?? []).forEach(p => set.add(p.category || 'Other'))
      ;(rr.data ?? []).forEach(r => set.add(r.category))
      const m: Record<string, string> = {}
      ;(rr.data ?? []).forEach(r => { m[r.category] = String(r.rate) })
      setCats([...set].sort())
      setRates(m); setInitial(m)
      setFallback(Number(c.data?.rate_per_unit) || 0)
      setLoading(false)
    })
  }, [currentClientId, courierId])

  const save = async () => {
    setSaving(true)
    try {
      const upserts = cats
        .filter(cat => String(rates[cat] ?? '').trim() !== '')
        .map(cat => ({ client_id: currentClientId!, courier_id: courierId, category: cat, rate: Number(rates[cat]) || 0 }))
      const cleared = cats.filter(cat => String(rates[cat] ?? '').trim() === '' && initial[cat] !== undefined)
      if (upserts.length) {
        const { error } = await supabase.from('courier_rates').upsert(upserts, { onConflict: 'courier_id,category' })
        if (error) throw error
      }
      if (cleared.length) {
        const { error } = await supabase.from('courier_rates').delete().eq('courier_id', courierId).in('category', cleared)
        if (error) throw error
      }
      setInitial({ ...rates })
      notify('success', 'Rate card saved')
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save rate card')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Loading rate card…" />

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Per-piece rate for each product category. Leave a category blank to use the courier's
        flat Rate/Unit{fallback ? <> (<b className="text-ink">{fallback}</b> BDT)</> : null}.
        Changing a rate only affects new challans — already-created challans keep the bill they were saved with.
      </p>
      <div className="overflow-hidden rounded-xl border border-surface-line">
        {cats.length === 0 ? (
          <p className="p-4 text-sm text-ink-faint">No product categories yet — add products first.</p>
        ) : cats.map((cat, i) => (
          <div key={cat} className={'flex items-center justify-between gap-3 px-4 py-2.5 ' + (i ? 'border-t border-surface-line' : '')}>
            <span className="text-sm font-medium text-ink">{cat}</span>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="0.01" disabled={!canEdit}
                value={rates[cat] ?? ''} placeholder={fallback ? String(fallback) : 'Rate'}
                onChange={e => setRates(r => ({ ...r, [cat]: e.target.value }))}
                className="fiori-input w-32 py-1.5 text-right" />
              <span className="text-xs text-ink-faint">BDT/pc</span>
            </div>
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button icon="save" loading={saving} onClick={save}>Save Rate Card</Button>
        </div>
      )}
    </div>
  )
}
