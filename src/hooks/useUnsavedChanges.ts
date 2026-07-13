import { useEffect } from 'react'

// Warns before the tab is closed or reloaded while a form has unsaved edits.
// Pass a boolean that is true only while the form is dirty and not mid-save.
// (Covers browser-level exits; in-app route guarding can layer on top later.)
export function useUnsavedChanges(when: boolean) {
  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])
}
