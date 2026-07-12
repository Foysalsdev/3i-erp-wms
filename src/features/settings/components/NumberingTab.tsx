import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Field'
import { SelectBox } from '@/components/ui/SelectBox'
import { Spinner } from '@/components/ui/States'
import { SearchBar } from '@/components/shared/SearchBar'
import { OPERATIONS } from '@/features/operations/registry'
import { DOC_CONFIGS } from '@/features/inbound/docConfigs'
import type { Tables } from '@/types/database.types'

type DocSequence = Tables<'document_sequences'>

// SAP-style number ranges: one row per document type, its prefix and digit
// padding editable, next number visible. The doc-type catalog is assembled
// dynamically from the operations + document registries (plus the bespoke
// flows), merged with whatever already exists in document_sequences — a new
// registry entry shows up here automatically.
const EXTRA_TYPES: Record<string, string> = {
  PR: 'Inward Requisition', CNT: 'Count Sheet',
  RINS: 'Return Inspection', RFB: 'Refurbishment'
}

function docTypeCatalog(): Record<string, string> {
  const out: Record<string, string> = {}
  Object.values(OPERATIONS).forEach(d => { out[d.docType] = d.title })
  Object.values(DOC_CONFIGS).forEach(d => { out[d.docType] = d.title })
  Object.entries(EXTRA_TYPES).forEach(([k, v]) => { out[k] ??= v })
  return out
}

interface Row { doc_type: string; label: string; prefix: string; padding: number; next_number: number; inDb: boolean }

const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(2)}`
}
const preview = (r: Row) => `${(r.prefix || r.doc_type).toUpperCase()}-${today()}${String(r.next_number).padStart(r.padding, '0')}`

export function NumberingTab({ canEdit }: { canEdit: boolean }) {
  const { currentClientId } = useAuth()
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  const load = () => {
    if (!currentClientId) return
    setLoading(true)
    supabase.from('document_sequences').select('doc_type,prefix,padding,next_number,last_date')
      .eq('client_id', currentClientId)
      .then(({ data }) => {
        const catalog = docTypeCatalog()
        const byType: Record<string, Pick<DocSequence, 'prefix' | 'padding' | 'next_number' | 'last_date'>> =
          Object.fromEntries((data ?? []).map(r => [r.doc_type, r]))
        const todayIso = new Date().toISOString().slice(0, 10)
        const all = new Set([...Object.keys(catalog), ...Object.keys(byType)])
        const out: Row[] = [...all].sort().map(t => {
          const db = byType[t]
          return {
            doc_type: t, label: catalog[t] ?? t,
            prefix: db?.prefix ?? t, padding: db?.padding ?? 4,
            // The counter resets daily — show 1 unless the row was already used today.
            next_number: db && db.last_date === todayIso ? db.next_number : 1,
            inDb: !!db
          }
        })
        setRows(out); setDirty(new Set()); setLoading(false)
      })
  }
  useEffect(load, [currentClientId])

  const patch = (t: string, p: Partial<Row>) => {
    setRows(rs => rs.map(r => r.doc_type === t ? { ...r, ...p } : r))
    setDirty(d => new Set(d).add(t))
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? rows.filter(r => r.label.toLowerCase().includes(t) || r.doc_type.toLowerCase().includes(t) || r.prefix.toLowerCase().includes(t)) : rows
  }, [rows, q])

  const save = async () => {
    if (!currentClientId || dirty.size === 0) return
    setSaving(true)
    try {
      for (const r of rows.filter(x => dirty.has(x.doc_type))) {
        const { error } = await supabase.rpc('update_doc_numbering', {
          p_client: currentClientId, p_doc_type: r.doc_type, p_prefix: r.prefix, p_padding: r.padding
        })
        if (error) throw new Error(`${r.doc_type}: ${error.message}`)
      }
      notify('success', `Numbering saved for ${dirty.size} document type(s)`)
      load()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save numbering')
    } finally { setSaving(false) }
  }

  if (loading) return <Card className="p-2"><Spinner label="Loading number ranges…" /></Card>

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div>
          <p className="text-sm text-ink-soft">Number ranges for every document type. Format: <span className="font-mono text-xs">PREFIX-DDMMYY####</span> — the counter resets each day, so the date keeps numbers unique. Changing a prefix applies from the next document; already-issued numbers never change.</p>
        </div>
        <div className="ml-auto w-full sm:w-64"><SearchBar value={q} onChange={setQ} placeholder="Search document type…" /></div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-line bg-surface-sunken text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2">Document Type</th>
              <th className="px-3 py-2">Prefix</th>
              <th className="px-3 py-2">Digits</th>
              <th className="px-3 py-2">Next number (today)</th>
              <th className="px-3 py-2">Preview</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.doc_type} className="border-b border-surface-line/70">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{r.label}</span>
                    <span className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">{r.doc_type}</span>
                    {dirty.has(r.doc_type) && <Badge tone="brand">edited</Badge>}
                    {!r.inDb && <span className="text-[11px] text-ink-faint">not used yet</span>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Input value={r.prefix} disabled={!canEdit} maxLength={8}
                    onChange={e => patch(r.doc_type, { prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                    className="w-28 font-mono uppercase" />
                </td>
                <td className="px-3 py-2">
                  <SelectBox value={String(r.padding)} disabled={!canEdit}
                    onChange={e => patch(r.doc_type, { padding: Number(e.target.value) })} className="w-20">
                    {[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={String(n)}>{n}</option>)}
                  </SelectBox>
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-soft">{r.next_number}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink">{preview(r)}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-faint">No matches</td></tr>}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-surface-line pt-4">
          {dirty.size > 0 && <span className="text-sm text-ink-soft">{dirty.size} unsaved change(s)</span>}
          <Button icon="save" loading={saving} disabled={dirty.size === 0} onClick={save}>Save Numbering</Button>
        </div>
      )}
    </Card>
  )
}
