import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUI } from '@/store/ui'
import type { Tables } from '@/types/database.types'

// Activity timeline derived from the audit_logs table for a given record.
export function useTimeline(table: string, recordId?: string) {
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<Tables<'audit_logs'>[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!recordId) return
    setLoading(true)
    supabase.from('audit_logs').select('*').eq('table_name', table).eq('record_id', recordId)
      .order('changed_at', { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (error) notify('error', `Could not load activity: ${error.message}`)
        setRows(data ?? []); setLoading(false)
      })
  }, [table, recordId, notify])
  return { rows, loading }
}
