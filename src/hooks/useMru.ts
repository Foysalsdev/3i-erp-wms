import { useCallback, useState } from 'react'
import { useAuth } from '@/store/auth'

// Most-recently-used list for a lookup field: remembers the last N picked ids
// per user + field in this browser, so a searchable lookup can surface "Recent"
// choices at the top when opened empty (Input History / MRU). Editable, local,
// non-blocking — storage failures fall back to an empty list.
export function useMru(key: string, max = 8): { ids: string[]; remember: (id: string) => void } {
  const userId = useAuth(s => s.profile?.id)
  const storageKey = `mru:${key}:${userId ?? 'anon'}`
  const [ids, setIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const remember = useCallback((id: string) => {
    if (!id) return
    setIds(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, max)
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }, [storageKey, max])
  return { ids, remember }
}
