import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/States'

// Optional inbound serial capture: scan/type the units received on a GRN so
// every serial has an "in_stock" origin the moment it enters the warehouse.
// Entirely optional — a GRN posts stock fine without serials; this only adds
// unit-level traceability (in via GRN, out via SO/challan).
//
// One serial per line per product (barcode guns that send Enter after each
// scan land naturally on a new line).
export function GrnSerialScan({ grn, products, clientId, notify, onClose }: any) {
  const [items, setItems] = useState<any[]>([])
  const [existing, setExisting] = useState<any[]>([])
  const [text, setText] = useState<Record<string, string>>({})   // product_id -> textarea
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('goods_receipt_items').select('product_id,received_qty,qty').eq('grn_id', grn.id),
      supabase.from('serial_numbers').select('id,serial_no,product_id,status').eq('client_id', clientId).eq('reference_no', grn.grn_no)
    ]).then(([it, sn]) => {
      const rows = it.data ?? []
      const serials = sn.data ?? []
      setItems(rows)
      setExisting(serials)
      setText(Object.fromEntries(rows.map((r: any) => [
        r.product_id,
        serials.filter((s: any) => s.product_id === r.product_id).map((s: any) => s.serial_no).join('\n')
      ])))
      setLoading(false)
    })
  }, [grn.id, grn.grn_no, clientId])

  const prodLabel = (id: string) => { const p = products.find((x: any) => x.id === id); return p ? `${p.material_code} — ${p.name}` : id }
  const parse = (s: string) => [...new Set(s.split(/\r?\n/).map(x => x.trim()).filter(Boolean))]
  const counts = useMemo(() => Object.fromEntries(items.map((it: any) => [it.product_id, parse(text[it.product_id] ?? '').length])), [items, text])

  const save = async () => {
    setSaving(true)
    try {
      // Reject the same serial typed under two different products in this form.
      const all = items.flatMap((it: any) => parse(text[it.product_id] ?? ''))
      const dupe = all.find((s, i) => all.indexOf(s) !== i)
      if (dupe) throw new Error(`Serial "${dupe}" is entered under more than one product`)

      const toInsert: any[] = []
      const toDelete: string[] = []
      for (const it of items) {
        const entered = new Set(parse(text[it.product_id] ?? ''))
        const prior = existing.filter((s: any) => s.product_id === it.product_id)
        for (const s of prior) {
          if (entered.has(s.serial_no)) continue
          // Removing a serial that already moved on (reserved/delivered) would
          // orphan its history — only still-in-stock ones can be un-scanned.
          if (s.status !== 'in_stock') throw new Error(`${s.serial_no} is already ${s.status} — it can't be removed from this GRN`)
          toDelete.push(s.id)
        }
        const priorSet = new Set(prior.map((s: any) => s.serial_no))
        for (const sn of entered) {
          if (!priorSet.has(sn)) toInsert.push({
            client_id: clientId, product_id: it.product_id, serial_no: sn,
            reference_no: grn.grn_no, warehouse_id: grn.warehouse_id || null, status: 'in_stock'
          })
        }
      }
      if (toInsert.length) {
        const { data: clash } = await supabase.from('serial_numbers').select('serial_no,reference_no')
          .eq('client_id', clientId).in('serial_no', toInsert.map(r => r.serial_no))
        const other = (clash ?? []).filter((c: any) => c.reference_no !== grn.grn_no)
        if (other.length) throw new Error(`Serial(s) already registered elsewhere: ${other.map((c: any) => `${c.serial_no} (${c.reference_no ?? '—'})`).slice(0, 3).join(', ')}`)
      }
      if (toDelete.length) {
        const { error } = await supabase.from('serial_numbers').delete().in('id', toDelete)
        if (error) throw error
      }
      if (toInsert.length) {
        const { error } = await supabase.from('serial_numbers').insert(toInsert as any)
        if (error) throw error
      }
      notify('success', `Serials saved for ${grn.grn_no} (${toInsert.length} added${toDelete.length ? `, ${toDelete.length} removed` : ''})`)
      onClose()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save serials')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Scan Serials — ${grn.grn_no}`} size="lg">
      {loading ? <Spinner label="Loading…" /> : (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Optional: scan or type the received unit serials, one per line. Serials are registered
            as <b className="text-ink">in stock</b> against this GRN, so each unit is traceable from
            receipt to delivery. Leave blank for products you don't serial-track.
          </p>
          {items.length === 0 ? <p className="py-4 text-center text-sm text-ink-faint">No line items on this GRN yet.</p> :
            items.map((it: any) => {
              const qty = Number(it.received_qty) > 0 ? Number(it.received_qty) : Number(it.qty)
              const n = counts[it.product_id] ?? 0
              return (
                <div key={it.product_id} className="rounded-xl border border-surface-line p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-ink">{prodLabel(it.product_id)}</p>
                    <Badge tone={n === 0 ? 'neutral' : n === qty ? 'positive' : 'info'}>{n}/{qty} scanned</Badge>
                  </div>
                  <textarea rows={Math.min(6, Math.max(2, n + 1))}
                    value={text[it.product_id] ?? ''}
                    onChange={e => setText(t => ({ ...t, [it.product_id]: e.target.value }))}
                    placeholder={'Scan serials here — one per line'}
                    className="fiori-input font-mono text-sm" />
                </div>
              )
            })}
          <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button icon="qr_code_scanner" loading={saving} onClick={save}>Save Serials</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
