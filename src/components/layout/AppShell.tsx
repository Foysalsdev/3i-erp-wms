import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Footer } from './Footer'
import { useUI } from '@/store/ui'
import { useAuth } from '@/store/auth'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { primeCompanyInfo, loadSettings, type WorkflowSettings } from '@/lib/settings'
import { setWorkflowSla } from '@/features/outbound/workflow'

// Neutral page-load skeleton for lazy route chunks: a title bar plus a table
// placeholder — generic enough for any page, calmer than a centred spinner.
function PageFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-3.5 w-80" /></div>
      <TableSkeleton rows={8} cols={6} />
    </div>
  )
}

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
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
            {/* Page chunk loads here (nav stays visible) behind a neutral page
                skeleton, so route-load and the page's own skeleton data-load read
                as one continuous, calm loading state instead of a spinner flash. */}
            <ErrorBoundary key={pathname}>
              <Suspense fallback={<PageFallback />}><Outlet /></Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <Footer />
    </div>
  )
}
