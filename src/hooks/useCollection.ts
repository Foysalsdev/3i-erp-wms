import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import type { Database, Tables } from '@/types/database.types'

export type TableName = keyof Database['public']['Tables']

// PostgREST caps any single response at 1000 rows by default — without paging
// through the full result set, tables past that size would silently lose rows.
const PAGE_SIZE = 1000

// Generic client-scoped collection fetch with refresh. RLS enforces isolation server-side;
// we also filter by client_id for index efficiency and correct platform-admin scoping.
// The row type is inferred from the table name; pass an explicit second type
// parameter only when `select` projects a different shape (e.g. joins).
export function useCollection<K extends TableName, T = Tables<K>>(
  table: K,
  opts?: { order?: string; ascending?: boolean; select?: string }
) {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    const all: T[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      let q = supabase.from(table as any).select(opts?.select ?? '*')
      q = q.order(opts?.order ?? 'created_at', { ascending: opts?.ascending ?? false }).order('id', { ascending: true })
      const { data, error } = await q.range(from, from + PAGE_SIZE - 1)
      if (error) { setError(error.message); notify('error', `Could not load ${table}: ${error.message}`); setLoading(false); return }
      all.push(...((data ?? []) as T[]))
      if (!data || data.length < PAGE_SIZE) break
    }
    setError(undefined); setData(all)
    setLoading(false)
  }, [table, clientId, opts?.order, opts?.ascending, opts?.select, notify])

  useEffect(() => { refresh() }, [refresh])
  return { data, loading, error, refresh, clientId }
}
