import { NavLink, useLocation } from 'react-router-dom'
import { MODULES } from '@/lib/constants'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils'

export function Sidebar({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const collapsed = useUI(s => s.sidebarCollapsed) && !mobile
  const can = useAuth(s => s.can)
  const { pathname } = useLocation()
  const items = MODULES.filter(m => !m.permission || can(m.permission))

  return (
    <aside className={cn('relative flex h-full flex-col border-r border-surface-line bg-sidebar text-sidebar-fg transition-[width] duration-300',
      collapsed ? 'w-[var(--sidebar-w-collapsed)]' : 'w-[var(--sidebar-w)]')}>
      <div className="flex h-[var(--header-h)] items-center gap-2.5 border-b border-surface-line px-4">
        <img src="/favicon.svg" alt="Whirlpool" className="h-9 w-9 shrink-0 rounded-xl ring-1 ring-surface-line" />
        {!collapsed && <div className="leading-tight">
          <p className="font-display text-[14px] font-bold tracking-tight">Whirlpool WH</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-muted">ERP · WMS</p>
        </div>}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {!collapsed && <p className="px-2.5 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-muted">Modules</p>}
        {items.map(m => {
          const active = pathname.startsWith(m.path)
          return (
            <NavLink key={m.key} to={m.path} onClick={onNavigate} title={m.label}
              className={cn('group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                active ? 'bg-sidebar-active font-semibold text-sidebar-activefg'
                       : 'text-sidebar-fg hover:bg-surface-sunken')}>
              {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-500" />}
              <Icon name={m.icon} className={cn('text-[20px]', active ? 'text-brand-600' : 'text-sidebar-muted')} filled={active} />
              {!collapsed && <span className="truncate">{m.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-surface-line px-4 py-3">
        {!collapsed
          ? <p className="text-[10px] font-medium text-sidebar-muted">v1.0 · Whirlpool WH</p>
          : <Icon name="verified" className="text-brand-500 text-[18px]" />}
      </div>
    </aside>
  )
}
