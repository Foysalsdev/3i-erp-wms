import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

// Runs `onOpen` once if the URL carries `?new=1` — set by the command
// palette's "New X" shortcuts so choosing one lands straight in the create
// form instead of just the list — then strips the param so a refresh or
// back-navigation doesn't reopen it.
export function useAutoOpen(onOpen: () => void) {
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    if (params.get('new') === '1') {
      onOpen()
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
