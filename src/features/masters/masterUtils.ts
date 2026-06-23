import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { RELATIONS, type MasterDef } from './registry'
import { formatDate } from '@/lib/utils'

export type RelLabels = Record<string, Record<string, string>> // fieldName -> (id -> label)

// Loads id->label maps for every relation field on a master.
export function useRelationLabels(def: MasterDef): RelLabels {
  const clientId = useAuth(s => s.currentClientId)
  const [maps, setMaps] = useState<RelLabels>({})
  useEffect(() => {
    if (!clientId) return
    def.fields.filter(f => f.relation).forEach(async f => {
      const rel = RELATIONS[f.relation!]
      const { data } = await supabase.from(rel.table as any).select(`id, ${rel.code}, ${rel.name}`).eq('client_id', clientId)
      const m: Record<string, string> = {}
      ;(data ?? []).forEach((r: any) => { m[r.id] = `${r[rel.code]}${r[rel.name] ? ' — ' + r[rel.name] : ''}` })
      setMaps(prev => ({ ...prev, [f.name]: m }))
    })
  }, [def, clientId])
  return maps
}

// Formats a single field value for display (relations, dates, booleans).
export function fieldDisplay(def: MasterDef, record: any, fieldName: string, rel: RelLabels): string {
  const f = def.fields.find(x => x.name === fieldName)
  if (!f) return record[fieldName] ?? '—'
  const v = record[fieldName]
  if (f.type === 'checkbox') return v ? 'Yes' : 'No'
  if (f.type === 'date') return v ? formatDate(v) : '—'
  if (f.relation) return (v && rel[fieldName]?.[v]) || '—'
  return (v ?? '') === '' ? '—' : String(v)
}
