import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// Seeds a list's search box from the `?q=` URL param (set by Universal Search
// deep-links) and keeps it in sync when the param changes. Returns the same
// [value, setter] shape as useState so call sites barely change.
export function useUrlSearch(): [string, (v: string) => void] {
  const [params] = useSearchParams()
  const [q, setQ] = useState(() => params.get('q') ?? '')

  useEffect(() => {
    const urlQ = params.get('q')
    if (urlQ != null && urlQ !== q) setQ(urlQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return [q, setQ]
}
