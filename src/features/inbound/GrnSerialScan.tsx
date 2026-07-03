import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/States'
import { normaliseSerial, describeSerialHistory, type SerialHistoryItem } from '@/lib/serials'
import { SerialHistoryModal } from '@/components/shared/SerialHistoryModal'

// Inbound serial capture for a GRN (optional). Built for real receiving work:
//  - a barcode gun types the serial and sends Enter — each scan lands as a row
//  - pasting a column copied from Excel (or any multi-line text) adds them all
//  - serials are normalised model-wise: our serials start with the 5-digit
//    Material Code; when a unit is labelled with a factory prefix instead
//    (China Code / barcode from the product master), that prefix is replaced
//    with the Material Code so one product always has one serial scheme.
// Saved serials register as in_stock against the GRN and receiving warehouse.

interface Row { serial: string; original?: string; existingId?: string; status?: string }

const norm = (s: string) => s.trim().toUpperCase()

export function GrnSerialScan({ grn, clientId, notify, onClose }: any) {
  const [items, setItems] = useState<any[]>([])
  const [prods, setProds] = useState<Record<string, any>>({})
  const [rows, setRows] = useState<Record<string, Row[]>>({})       // product_id -> captured serials
  const [input, setInput] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<SerialHistoryItem[] | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  // DB-backed serial ids per product at load time — save() diffs against this
  // to know which previously saved serials the user removed.
  const seededIds = useRef<Record<string, string[]>>({})

  useEffect(() => {
    Promise.all([
      supabase.from('goods_receipt_items').select('product_id,received_qty,qty').eq('grn_id', grn.id),
      (supabase as any).from('products').select('id,material_code,name,china_code,barcode').eq('client_id', clientId),
      supabase.from('serial_numbers').select('id,serial_no,product_id,status').eq('client_id', clientId).eq('reference_no', grn.grn_no)
    ]).then(([it, pr, sn]: any[]) => {
      const lines = it.data ?? []
      setItems(lines)
      setProds(Object.fromEntries((pr.data ?? []).map((p: any) => [p.id, p])))
      const m: Record<string, Row[]> = Object.fromEntries(lines.map((l: any) => [l.product_id, []]))
      ;(sn.data ?? []).forEach((s: any) => {
        (m[s.product_id] ??= []).push({ serial: s.serial_no, existingId: s.id, status: s.status })
      })
      setRows(m)
      seededIds.current = Object.fromEntries(Object.entries(m).map(([pid, list]) => [pid, list.filter(r => r.existingId).map(r => r.existingId!)]))
      setLoading(false)
    })
  }, [grn.id, grn.grn_no, clientId])

  const allSerials = useMemo(() => {
    const set = new Map<string, string>() // serial -> product_id
    for (const [pid, list] of Object.entries(rows)) list.forEach(r => set.set(norm(r.serial), pid))
    return set
  }, [rows])

  // Add one or many raw scans to a product; returns how many were new.
  const add = (pid: string, raws: string[]) => {
    const p = prods[pid]
    let added = 0, dupes = 0
    const fresh: Row[] = []
    for (const raw of raws) {
      const r: Row = normaliseSerial(raw, p ?? {})
      if (!r.serial) continue
      const owner = allSerials.get(norm(r.serial))
      if (owner || fresh.some(f => norm(f.serial) === norm(r.serial))) { dupes++; continue }
      fresh.push(r); added++
    }
    if (fresh.length) setRows(m => ({ ...m, [pid]: [...fresh, ...(m[pid] ?? [])] }))
    if (dupes) notify('info', `${dupes} duplicate serial(s) skipped`)
    return added
  }

  const onKey = (pid: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const v = input[pid] ?? ''
    if (v.trim()) { add(pid, [v]); setInput(s => ({ ...s, [pid]: '' })) }
  }

  // Excel column / multi-line paste: capture every line in one go.
  const onPaste = (pid: string, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!/[\r\n\t]/.test(text)) return
    e.preventDefault()
    const parts = text.split(/[\r\n\t]+/).map(s => s.trim()).filter(Boolean)
    const n = add(pid, parts)
    if (n) notify('success', `${n} serial(s) captured from paste`)
  }

  const remove = (pid: string, r: Row) => {
    if (r.existingId && r.status && r.status !== 'in_stock') {
      notify('error', `${r.serial} is already ${r.status} — it can't be removed from this GRN`); return
    }
    setRows(m => ({ ...m, [pid]: (m[pid] ?? []).filter(x => x !== r) }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const toInsert: any[] = []
      const toDelete: string[] = []
      for (const it of items) {
        const list = rows[it.product_id] ?? []
        list.filter(r => !r.existingId).forEach(r => toInsert.push({
          client_id: clientId, product_id: it.product_id, serial_no: r.serial,
          reference_no: grn.grn_no, warehouse_id: grn.warehouse_id || null, status: 'in_stock'
        }))
        // Previously saved serials no longer in the list -> delete (guarded in remove()).
        const kept = new Set(list.filter(r => r.existingId).map(r => r.existingId))
        ;(seededIds.current[it.product_id] ?? []).forEach(id => { if (!kept.has(id)) toDelete.push(id) })
      }
      // Serials with EARLIER transaction history (e.g. delivered before, now
      // coming back) are allowed: re-registered to this GRN as in_stock, with
      // a small popup showing where each was last. Same-form duplicates were
      // already blocked at scan time.
      let reused: any[] = []
      if (toInsert.length) {
        const { data: clash } = await supabase.from('serial_numbers').select('id,serial_no,reference_no,status')
          .eq('client_id', clientId).in('serial_no', toInsert.map(r => r.serial_no))
        reused = (clash ?? []).filter((c: any) => c.reference_no !== grn.grn_no)
      }
      if (toDelete.length) {
        const { error } = await supabase.from('serial_numbers').delete().in('id', toDelete)
        if (error) throw error
      }
      let hist: SerialHistoryItem[] = []
      if (reused.length) {
        hist = await describeSerialHistory(clientId, reused)   // capture before overwriting
        const { error } = await supabase.from('serial_numbers')
          .update({ reference_no: grn.grn_no, warehouse_id: grn.warehouse_id || null, status: 'in_stock', so_item_id: null } as any)
          .in('id', reused.map((r: any) => r.id))
        if (error) throw error
      }
      const reusedSet = new Set(reused.map((r: any) => r.serial_no))
      const inserts = toInsert.filter(r => !reusedSet.has(r.serial_no))
      if (inserts.length) {
        const { error } = await supabase.from('serial_numbers').insert(inserts as any)
        if (error) throw error
      }
      notify('success', `${grn.grn_no}: ${inserts.length + reused.length} serial(s) saved${toDelete.length ? `, ${toDelete.length} removed` : ''}`)
      if (hist.length) setHistory(hist)
      else onClose()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save serials')
    } finally { setSaving(false) }
  }

  const label = (pid: string) => { const p = prods[pid]; return p ? `${p.material_code} — ${p.name}` : pid }

  return (
    <Modal open onClose={onClose} title={`Receive Serials — ${grn.grn_no}`} size="lg">
      {loading ? <Spinner label="Loading…" /> : (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Scan with a barcode gun (Enter after each scan) or paste a column straight from Excel.
            Factory prefixes (China code / barcode) are converted to the Material Code automatically.
            Optional — leave products blank if they aren't serial-tracked.
          </p>

          {items.length === 0 ? <p className="py-4 text-center text-sm text-ink-faint">No line items on this GRN yet.</p> :
            items.map((it: any) => {
              const qty = Number(it.received_qty) > 0 ? Number(it.received_qty) : Number(it.qty)
              const list = rows[it.product_id] ?? []
              const complete = list.length >= qty && qty > 0
              return (
                <div key={it.product_id} className="overflow-hidden rounded-xl border border-surface-line">
                  <div className="flex items-center justify-between gap-3 border-b border-surface-line bg-surface-sunken/60 px-4 py-2.5">
                    <p className="min-w-0 truncate text-sm font-semibold text-ink">{label(it.product_id)}</p>
                    <span className={'shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ' + (complete ? 'bg-ok/10 text-ok' : list.length ? 'bg-brand-500/15 text-brand-700' : 'bg-surface-sunken text-ink-faint')}>
                      {list.length} / {qty}
                    </span>
                  </div>
                  <div className="p-3">
                    <input
                      ref={el => { inputRefs.current[it.product_id] = el }}
                      value={input[it.product_id] ?? ''}
                      onChange={e => setInput(s => ({ ...s, [it.product_id]: e.target.value }))}
                      onKeyDown={e => onKey(it.product_id, e)}
                      onPaste={e => onPaste(it.product_id, e)}
                      placeholder="Scan serial and press Enter — or paste a list"
                      className="fiori-input font-mono"
                      autoComplete="off" spellCheck={false}
                    />
                    {list.length > 0 && (
                      <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-surface-line">
                        {list.map((r, i) => (
                          <div key={r.serial} className={'flex items-center justify-between gap-2 px-3 py-1.5 text-sm ' + (i ? 'border-t border-surface-line/70' : '')}>
                            <span className="min-w-0 truncate font-mono text-ink">{r.serial}</span>
                            <span className="flex shrink-0 items-center gap-2 text-xs text-ink-faint">
                              {r.original && <span title={`Scanned as ${r.original}`}>was {r.original}</span>}
                              {r.existingId && <span className="text-ink-faint">saved</span>}
                              <button type="button" onClick={() => remove(it.product_id, r)}
                                className="rounded p-0.5 text-ink-faint hover:bg-surface-sunken hover:text-bad">
                                <Icon name="close" className="text-[16px]" />
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

          <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button icon="save" loading={saving} onClick={save}>Save Serials</Button>
          </div>
          {history && <SerialHistoryModal items={history} onClose={onClose} />}
        </div>
      )}
    </Modal>
  )
}
