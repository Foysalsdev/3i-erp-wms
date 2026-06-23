import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUI } from '@/store/ui'

export function AppShell() {
  const [mobileNav, setMobileNav] = useState(false)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
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
        <main className="flex-1 overflow-y-auto p-5 sm:p-7"><Outlet /></main>
      </div>
    </div>
  )
}
