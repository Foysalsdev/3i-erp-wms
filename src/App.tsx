import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { WhirlpoolLoader } from '@/components/ui/WhirlpoolLoader'
import { Toaster } from '@/components/ui/Toaster'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { RequirePermission } from '@/components/layout/RequirePermission'
import LoginPage from '@/features/auth/LoginPage'
import { ModulePlaceholder } from '@/features/placeholder/ModulePlaceholder'
import { MODULES } from '@/lib/constants'

// Route-level code splitting: heavy pages (and their deps like recharts) load on demand.
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const MastersPage = lazy(() => import('@/features/masters/pages/MastersPage'))
const InventoryPage = lazy(() => import('@/features/inventory/pages/InventoryPage'))
const OperationsModulePage = lazy(() => import('@/features/operations/pages/OperationsModulePage').then(m => ({ default: m.OperationsModulePage })))
const InboundPage = lazy(() => import('@/features/inbound/InboundPage'))
const OutboundPage = lazy(() => import('@/features/outbound/OutboundPage'))
const ReportsPage = lazy(() => import('@/features/reports/pages/ReportsPage'))
const HrPage = lazy(() => import('@/features/hr/pages/HrPage'))
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'))
const ReversePage = lazy(() => import('@/features/reverse/pages/ReversePage'))
const FinancePage = lazy(() => import('@/features/finance/pages/FinancePage'))

// Modules still served by the generic operational register page.
const OPERATIONS_MODULES = ['transport']
// Modules still rendered as navigation scaffolds.
const PLACEHOLDERS = ['asset']

export default function App() {
  const { session, loading, contextReady, init } = useAuth()
  useEffect(() => { init() }, [init])
  // Preload the landing-page chunk while auth is still initialising, so after
  // the boot splash the dashboard renders straight into its own data loader
  // instead of flashing the route Suspense fallback in between.
  useEffect(() => { import('@/features/dashboard/DashboardPage') }, [])

  if (loading) return <WhirlpoolLoader fullScreen />
  // Stay on the login screen (its button spinner is the only loader) until the
  // profile/permission context is fully loaded — entering the shell earlier
  // flashes "Access restricted" and a cascade of skeletons.
  if (!session || !contextReady) return <><LoginPage /><Toaster /></>

  return (
    <>
      <ErrorBoundary>
      <Suspense fallback={<WhirlpoolLoader fullScreen />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/:tab?" element={<RequirePermission perm="dashboard.view"><DashboardPage /></RequirePermission>} />
            <Route path="/masters/:entity?" element={<RequirePermission perm="masters.view"><MastersPage /></RequirePermission>} />
            <Route path="/inventory/:tab?" element={<RequirePermission perm="inventory.view"><InventoryPage /></RequirePermission>} />
            <Route path="/inbound/:tab?" element={<RequirePermission perm="inbound.view"><InboundPage /></RequirePermission>} />
            <Route path="/outbound/:tab?" element={<RequirePermission perm="outbound.view"><OutboundPage /></RequirePermission>} />
            <Route path="/reports/:tab?" element={<RequirePermission perm="reports.view"><ReportsPage /></RequirePermission>} />
            <Route path="/hr/:tab?" element={<RequirePermission perm="hr.view"><HrPage /></RequirePermission>} />
            <Route path="/settings/:tab?" element={<RequirePermission perm="settings.view"><SettingsPage /></RequirePermission>} />
            <Route path="/reverse/:tab?" element={<RequirePermission perm="reverse.view"><ReversePage /></RequirePermission>} />
            <Route path="/finance/:tab?" element={<RequirePermission perm="finance.view"><FinancePage /></RequirePermission>} />
            {OPERATIONS_MODULES.map(key => {
              const m = MODULES.find(x => x.key === key)!
              return <Route key={key} path={`/${key}/:tab?`} element={
                <RequirePermission perm={m.permission}><OperationsModulePage moduleKey={key} /></RequirePermission>} />
            })}
            {PLACEHOLDERS.map(key => {
              const m = MODULES.find(x => x.key === key)!
              return <Route key={key} path={`/${key}/:tab?`} element={
                <RequirePermission perm={m.permission}><ModulePlaceholder module={m} /></RequirePermission>} />
            })}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
      </ErrorBoundary>
      <Toaster />
    </>
  )
}
