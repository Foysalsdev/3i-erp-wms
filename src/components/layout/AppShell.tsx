import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUI } from '@/store/ui'
import { useAuth } from '@/store/auth'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Spinner } from '@/components/ui/States'
import { primeCompanyInfo, loadSettings, type WorkflowSettings } from '@/lib/settings'
import { setWorkflowSla } from '@/features/outbound/workflow'

export function AppShell() {
  const [mobileNav, setMobileNav] = useState(false)
  const currentClientId = useAuth(s => s.currentClientId)
  const { pathname } = useLocation()
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  // Prime the per-client configuration consumed outside the React tree:
  // company profile for PDFs and the outbound workflow SLA overrides.
  useEffect(() => {
    if (!currentClientId) { setWorkflowSla(null); return }
    let active = true
    primeCompanyInfo(currentClientId)
    loadSettings<WorkflowSettings>(currentClientId, 'workflow').then(wf => {
      if (active) setWorkflowSla(Object.fromEntries(wf.stages.map(s => [s.key, s.slaDays])))
    })
    return () => { active = false }
  }, [currentClientId])

  useUI()
  return (
    <div className="flex h-full overflow-hidden">
      <div className="hidden lg:block"><Sidebar /></div>
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
          <div className="absolute left-0 top-0 h-full"><Sidebar mobile onNavigate={() => setMobileNav(false)} /></div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNav(true)} />
        <main className="flex-1 overflow-y-auto p-5 sm:p-7">
          {/* Page chunk loads here (nav stays visible) with the same Spinner the
              pages use for data loading, so route-load and data-load look like
              one continuous loader instead of a whirlpool then a spinner. */}
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<Spinner label="Loading…" />}><Outlet /></Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
