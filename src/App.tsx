import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { Spinner } from '@/components/ui/States'
import { Toaster } from '@/components/ui/Toaster'
import { AppShell } from '@/components/layout/AppShell'
import { RequirePermission } from '@/components/layout/RequirePermission'
import LoginPage from '@/features/auth/LoginPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import MastersPage from '@/features/masters/pages/MastersPage'
import InventoryPage from '@/features/inventory/pages/InventoryPage'
import { ModulePlaceholder } from '@/features/placeholder/ModulePlaceholder'
import { MODULES } from '@/lib/constants'

const PLACEHOLDERS = ['inbound', 'outbound', 'reverse', 'transport', 'asset', 'finance', 'hr', 'reports', 'settings']

export default function App() {
  const { session, loading, init } = useAuth()
  useEffect(() => { init() }, [init])

  if (loading) return <div className="flex h-full items-center justify-center"><Spinner label="Loading workspace…" /></div>
  if (!session) return <><LoginPage /><Toaster /></>

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<RequirePermission perm="dashboard.view"><DashboardPage /></RequirePermission>} />
          <Route path="/masters/:entity?" element={<RequirePermission perm="masters.view"><MastersPage /></RequirePermission>} />
          <Route path="/inventory/:tab?" element={<RequirePermission perm="inventory.view"><InventoryPage /></RequirePermission>} />
          {PLACEHOLDERS.map(key => {
            const m = MODULES.find(x => x.key === key)!
            return <Route key={key} path={`/${key}/:tab?`} element={
              <RequirePermission perm={m.permission}><ModulePlaceholder module={m} /></RequirePermission>} />
          })}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}
