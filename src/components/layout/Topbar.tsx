import { useState } from 'react'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Icon } from '@/components/ui/Icon'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { DensityToggle } from '@/components/ui/DensityToggle'
import { initials } from '@/lib/utils'
import { GlobalSearch } from './GlobalSearch'
import { NotificationBell } from './NotificationBell'
import { MyProfileModal } from '@/features/auth/MyProfileModal'
import type { Tables } from '@/types/database.types'

function Avatar({ profile, className }: { profile: Pick<Tables<'profiles'>, 'avatar_url' | 'full_name' | 'email'> | null; className?: string }) {
  return profile?.avatar_url
    ? <img src={profile.avatar_url} alt="" className={`rounded-full object-cover ${className}`} />
    : <span className={`flex items-center justify-center rounded-full bg-surface-sunken text-xs font-bold text-ink-soft ${className}`}>{initials(profile?.full_name || profile?.email)}</span>
}

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { profile, signOut, isPlatformAdmin } = useAuth()
  const { toggleSidebar } = useUI()
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-h)] items-center gap-2 border-b border-surface-line bg-surface px-3 sm:px-5">
      <button onClick={onOpenMobileNav} className="rounded-lg p-2 text-ink-soft hover:bg-surface-sunken lg:hidden"><Icon name="menu" /></button>
      <button onClick={toggleSidebar} className="hidden rounded-lg p-2 text-ink-soft hover:bg-surface-sunken lg:block"><Icon name="menu_open" /></button>

      <button onClick={() => setSearch(true)}
        className="flex flex-1 max-w-md items-center gap-2 rounded-lg border border-surface-line bg-surface-sunken px-3.5 py-2 text-sm text-ink-faint transition hover:border-brand-300">
        <Icon name="search" className="text-[19px]" /> <span className="truncate">Search across modules…</span>
        <kbd className="ml-auto hidden rounded border border-surface-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold sm:block">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <NotificationBell />

        <div className="relative">
          <button onClick={() => setMenu(m => !m)} className="flex items-center gap-2 rounded-full p-0.5 ring-1 ring-surface-line hover:ring-brand-300">
            <Avatar profile={profile} className="h-9 w-9" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl bg-surface shadow-pop ring-1 ring-surface-line">
                <div className="flex items-center gap-3 border-b border-surface-line px-4 py-3">
                  <Avatar profile={profile} className="h-9 w-9" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{profile?.full_name || 'User'}</p>
                    <p className="truncate text-xs text-ink-soft">{profile?.email}</p>
                  </div>
                </div>
                {isPlatformAdmin && <p className="px-4 pt-2"><span className="inline-block rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-surface">PLATFORM ADMIN</span></p>}
                <button onClick={() => { setMenu(false); setShowProfile(true) }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-sunken">
                  <Icon name="account_circle" className="text-[18px]" /> My Profile
                </button>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[11px] font-semibold text-ink-soft">Appearance</span>
                  <ThemeToggle />
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[11px] font-semibold text-ink-soft">Row density</span>
                  <DensityToggle />
                </div>
                <button onClick={signOut} className="flex w-full items-center gap-2 border-t border-surface-line px-4 py-2.5 text-sm font-semibold text-bad hover:bg-surface-sunken">
                  <Icon name="logout" className="text-[18px]" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <GlobalSearch open={search} onClose={() => setSearch(false)} />
      {showProfile && <MyProfileModal onClose={() => setShowProfile(false)} />}
    </header>
  )
}
