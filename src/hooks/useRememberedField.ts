import { useState } from 'react'
import { useAuth } from '@/store/auth'

// Remembers a free-text field (e.g. "Sent By" / "Prepared By") per logged-in
// user in this browser, so it only has to be typed once and then defaults to
// the last value on every new form — still fully editable each time.
export function useRememberedField(key: string, fallback = ''): [string, (v: string) => void] {
  const userId = useAuth(s => s.profile?.id)
  const storageKey = `finance:${key}:${userId ?? 'anon'}`
  const [value, setValue] = useState(() => { try { return localStorage.getItem(storageKey) ?? fallback } catch { return fallback } })
  const update = (v: string) => { setValue(v); try { localStorage.setItem(storageKey, v) } catch { /* storage unavailable */ } }
  return [value, update]
}
