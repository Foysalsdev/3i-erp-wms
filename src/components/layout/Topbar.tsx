import { useState } from 'react'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Icon } from '@/components/ui/Icon'
import { initials } from '@/lib/utils'
import { GlobalSearch } from './GlobalSearch'
import { NotificationBell } from './NotificationBell'

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { profile, clients, currentClientId, setClient, signOut, isPlatformAdmin } = useAuth()
  const { toggleSidebar, theme, toggleTheme } = useUI()
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState(false)
  const current = clients.find(c => c.id === currentClientId)

  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-h)] items-center gap-2 border-b border-surface-line/60 bg-surface/70 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-150 sm:px-5">
      <button onClick={onOpenMobileNav} className="rounded-lg p-2 text-ink-soft hover:bg-surface-sunken lg:hidden"><Icon name="menu" /></button>
      <button onClick={toggleSidebar} className="hidden rounded-lg p-2 text-ink-soft hover:bg-surface-sunken lg:block"><Icon name="menu_open" /></button>

      <button onClick={() => setSearch(true)}
        className="flex flex-1 max-w-md items-center gap-2 rounded-lg border border-surface-line bg-surface-sunken px-3.5 py-2 text-sm text-ink-faint transition hover:border-brand-300">
        <Icon name="search" className="text-[19px]" /> <span className="truncate">Search across modules…</span>
        <kbd className="ml-auto hidden rounded border border-surface-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold sm:block">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <div className="relative hidden items-center rounded-lg border border-surface-line bg-surface pl-2.5 pr-1 sm:flex">
          <Icon name="domain" className="text-[18px] text-ink-faint" />
          <select value={currentClientId ?? ''} onChange={e => setClient(e.target.value)}
            className="appearance-none bg-transparent py-2 pl-2 pr-7 text-sm font-semibold text-ink outline-none">
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_internal ? ' (Internal)' : ''}</option>)}
          </select>
          <Icon name="expand_more" className="pointer-events-none absolute right-2 text-[18px] text-ink-faint" />
        </div>

        <button onClick={toggleTheme} title="Toggle theme" className="rounded-lg p-2 text-ink-soft hover:bg-surface-sunken">
          <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
        </button>
        <NotificationBell />

        <div className="relative">
          <button onClick={() => setMenu(m => !m)} className="flex items-center gap-2 rounded-full p-0.5 ring-1 ring-surface-line hover:ring-brand-300">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{initials(profile?.full_name || profile?.email)}</span>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl bg-surface shadow-pop ring-1 ring-surface-line">
                <div className="flex items-center gap-3 border-b border-surface-line px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{initials(profile?.full_name || profile?.email)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{profile?.full_name || 'User'}</p>
                    <p className="truncate text-xs text-ink-soft">{profile?.email}</p>
                  </div>
                </div>
                {isPlatformAdmin && <p className="px-4 pt-2"><span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-brand-100">PLATFORM ADMIN</span></p>}
                {/* Client switcher inside the menu — the only way to switch clients on mobile (the bar selector is hidden below sm). */}
                <div className="px-4 py-2 sm:hidden">
                  <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Active client</label>
                  <div className="relative flex items-center rounded-lg border border-surface-line bg-surface">
                    <Icon name="domain" className="ml-2.5 text-[18px] text-ink-faint" />
                    <select value={currentClientId ?? ''} onChange={e => setClient(e.target.value)}
                      className="w-full appearance-none bg-transparent py-2 pl-2 pr-7 text-sm font-semibold text-ink outline-none">
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_internal ? ' (Internal)' : ''}</option>)}
                    </select>
                    <Icon name="expand_more" className="pointer-events-none absolute right-2 text-[18px] text-ink-faint" />
                  </div>
                </div>
                <p className="px-4 py-2 text-[11px] text-ink-soft sm:block hidden">Active client: <b className="text-ink">{current?.name}</b></p>
                <button onClick={signOut} className="flex w-full items-center gap-2 border-t border-surface-line px-4 py-2.5 text-sm font-semibold text-bad hover:bg-surface-sunken">
                  <Icon name="logout" className="text-[18px]" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <GlobalSearch open={search} onClose={() => setSearch(false)} />
    </header>
  )
}
