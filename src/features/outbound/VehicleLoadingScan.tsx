import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatNumber } from '@/lib/utils'
import { normaliseSerial } from '@/lib/serials'

const now = () => new Date()
const timeStamp = (d: Date) => `${d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`

interface Expected { serial_no: string; product_id: string; matched: boolean }

// Second scan of the outbound flow (docs/TRACKING-ARCHITECTURE workflow, per
// user request): the first scan (SerialScan.tsx) reserves serials against the
// order while picking; this one re-scans at vehicle loading and matches
// against that same reserved set, so what actually leaves on the truck is
// verified against what was picked — not re-typed or trusted blind. Matched
// serials get tagged to this gate pass (status -> delivered); the scan
// session's start/end become the gate pass's in/out time.
export function VehicleLoadingScan({ challan, vehicles, onClose, onDone }: {
  challan: Tables<'delivery_challans'>; vehicles: Pick<Tables<'vehicles'>, 'id' | 'vehicle_number'>[]
  onClose: () => void; onDone: () => void
}) {
  const { currentClientId } = useAuth()
  const notify = useUI(s => s.notify)
  const [loading, setLoading] = useState(true)
  const [gatePass, setGatePass] = useState<Tables<'gate_passes'> | null>(null)
  const [expected, setExpected] = useState<Expected[]>([])
  const [products, setProducts] = useState<Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'china_code' | 'barcode'>[]>([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!currentClientId || !challan?.id) return
    setLoading(true)
    ;(async () => {
      const [{ data: gp }, { data: so }] = await Promise.all([
        supabase.from('gate_passes').select('*').eq('challan_id', challan.id).maybeSingle(),
        challan.sales_order_id
          ? supabase.from('sales_orders').select('so_no').eq('id', challan.sales_order_id).single()
          : Promise.resolve({ data: null as { so_no: string } | null })
      ])
      setGatePass(gp ?? null)
      if (!so?.so_no) { setExpected([]); setLoading(false); return }
      // Still-reserved units for this order (not yet loaded on an earlier
      // partial shipment) are what's left to verify for this vehicle.
      const { data: serials } = await supabase.from('serial_numbers')
        .select('serial_no,product_id').eq('client_id', currentClientId).eq('reference_no', so.so_no).eq('status', 'reserved')
      const list = (serials ?? []).map(s => ({ serial_no: s.serial_no, product_id: s.product_id ?? '', matched: false }))
      setExpected(list)
      const pids = [...new Set(list.map(s => s.product_id))]
      if (pids.length) {
        const { data: prods } = await supabase.from('products').select('id,material_code,name,china_code,barcode').in('id', pids)
        setProducts(prods ?? [])
      }
      setLoading(false)
    })()
  }, [currentClientId, challan?.id])

  useEffect(() => { if (!loading) inputRef.current?.focus() }, [loading])

  const matchedCount = expected.filter(e => e.matched).length
  const remaining = expected.filter(e => !e.matched)

  const productOf = (id: string) => products.find(p => p.id === id)

  // A scan matches an expected serial either directly (already in canonical
  // material-code form from the first scan) or after normalising against
  // that specific unit's product codes (factory/barcode prefix scanned again).
  const resolveMatch = (raw: string): number => {
    const s = raw.trim()
    if (!s) return -1
    const upS = s.toUpperCase()
    let idx = expected.findIndex(e => !e.matched && e.serial_no.toUpperCase() === upS)
    if (idx >= 0) return idx
    idx = expected.findIndex(e => {
      if (e.matched) return false
      const p = productOf(e.product_id)
      if (!p) return false
      const { serial } = normaliseSerial(s, { material_code: p.material_code, china_code: p.china_code, barcode: p.barcode })
      return serial.toUpperCase() === e.serial_no.toUpperCase()
    })
    return idx
  }

  const scan = () => {
    const idx = resolveMatch(input)
    if (idx < 0) {
      notify('error', expected.some(e => e.serial_no.toUpperCase() === input.trim().toUpperCase())
        ? 'Already loaded' : 'Not an expected serial for this order')
      setInput('')
      return
    }
    if (!startedAt) setStartedAt(timeStamp(now()))
    setExpected(list => list.map((e, i) => i === idx ? { ...e, matched: true } : e))
    setInput('')
  }

  const finish = async () => {
    if (matchedCount === 0) { notify('error', 'Scan at least one unit before finishing'); return }
    if (matchedCount < expected.length &&
      !window.confirm(`${expected.length - matchedCount} unit(s) still not scanned — finish loading anyway?`)) return
    setSaving(true)
    try {
      const matchedSerials = expected.filter(e => e.matched).map(e => e.serial_no)
      let gp = gatePass
      if (!gp) { notify('error', 'No gate pass found for this challan yet — issue the challan first'); return }
      const { error: e1 } = await supabase.from('serial_numbers')
        .update({ status: 'delivered', gate_pass_id: gp.id })
        .eq('client_id', currentClientId!).in('serial_no', matchedSerials)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('gate_passes').update({
        gate_in_time: gp.gate_in_time || startedAt || timeStamp(now()),
        gate_out_time: timeStamp(now()),
        loaded_serial_count: (Number(gp.loaded_serial_count) || 0) + matchedSerials.length
      }).eq('id', gp.id)
      if (e2) throw e2
      notify('success', `${matchedSerials.length} serial(s) loaded & tagged to ${gp.gate_pass_no}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save loading scan')
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Load Vehicle — ${challan.challan_no}`} size="md">
      <div className="space-y-4">
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-faint">Loading…</p>
        ) : !gatePass ? (
          <div className="flex items-center gap-2 rounded-xl border border-bad/30 bg-bad/5 p-4 text-sm text-bad">
            <Icon name="error" className="text-[20px]" /> No gate pass exists for this challan yet.
          </div>
        ) : expected.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 text-sm text-ink-soft">
            <Icon name="info" className="text-[20px]" /> Nothing reserved & waiting to load for this order.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl border border-surface-line bg-surface-sunken/40 p-3.5">
              <div className="text-sm">
                <span className="text-ink-faint">Vehicle </span>
                <span className="font-semibold text-ink">{vehicles.find(v => v.id === (gatePass.vehicle_id || challan.vehicle_id))?.vehicle_number ?? '—'}</span>
                <span className="ml-3 text-ink-faint">Driver </span><span className="font-semibold text-ink">{gatePass.driver_name || challan.driver_name || '—'}</span>
              </div>
              <Badge tone={matchedCount === expected.length ? 'positive' : 'info'}>{matchedCount}/{expected.length} matched</Badge>
            </div>

            <div>
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); scan() } }}
                placeholder="Scan or type a serial number…"
                className="w-full rounded-lg border border-brand-200/70 bg-surface px-3 py-2.5 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25" />
              <p className="mt-1 text-[11px] text-ink-faint">Press Enter after each scan. Only serials reserved on this order are accepted.</p>
            </div>

            <Card className="max-h-[35vh] overflow-y-auto p-0">
              {expected.map((e, i) => {
                const p = productOf(e.product_id)
                return (
                  <div key={e.serial_no} className={'flex items-center justify-between gap-3 px-3.5 py-2 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon name={e.matched ? 'check_circle' : 'radio_button_unchecked'} className={'text-[16px] ' + (e.matched ? 'text-ok' : 'text-ink-faint')} />
                      <span className="min-w-0 truncate font-mono text-xs text-ink">{e.serial_no}</span>
                    </span>
                    <span className="shrink-0 truncate text-xs text-ink-faint">{p?.material_code ?? ''}</span>
                  </div>
                )
              })}
            </Card>

            {remaining.length > 0 && (
              <p className="text-xs text-ink-faint">{remaining.length} unit(s) still not scanned.</p>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {!loading && gatePass && expected.length > 0 && (
            <Button icon="local_shipping" loading={saving} onClick={finish}>Finish Loading</Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
