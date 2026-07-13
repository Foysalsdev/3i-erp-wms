import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

type Profile = Tables<'profiles'>

// Single-tenant build. There used to be a multi-client tenancy layer (a `clients`
// table, per-client `user_clients` membership and a client switcher). That has
// been removed — the whole system now serves one implicit client. A handful of
// legacy call sites still read `currentClientId` / `clients` (mostly to print a
// name on documents), so we keep those as stable constants rather than threading
// a real tenant id through the app.
export const SINGLE_CLIENT_ID = 'default'
type Client = { id: string; name: string; is_internal: boolean }
const SINGLE_CLIENT: Client = { id: SINGLE_CLIENT_ID, name: 'Whirlpool', is_internal: false }

interface AuthState {
  session: Session | null
  profile: Profile | null
  clients: Client[]
  currentClientId: string
  permissions: Set<string>
  isPlatformAdmin: boolean
  loading: boolean
  // True once profile/permissions have loaded for the current session. The app
  // must not enter the shell before this — otherwise the user sees a
  // permission-less flash ("Access restricted") and a cascade of loaders.
  contextReady: boolean
  init: () => Promise<void>
  loadContext: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  can: (perm: string) => boolean
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  clients: [SINGLE_CLIENT],
  currentClientId: SINGLE_CLIENT_ID,
  permissions: new Set(),
  isPlatformAdmin: false,
  loading: true,
  contextReady: false,

  init: async () => {
    const { data } = await supabase.auth.getSession()
    set({ session: data.session })
    if (data.session) await get().loadContext()
    set({ loading: false })
    supabase.auth.onAuthStateChange(async (_e, session) => {
      set({ session })
      // signIn() already awaits loadContext, and token refreshes don't change
      // the context — only load here when it hasn't been loaded yet.
      if (session) { if (!get().contextReady) await get().loadContext() }
      else set({ profile: null, permissions: new Set(), contextReady: false })
    })
  },

  loadContext: async () => {
    const uid = get().session?.user.id
    if (!uid) return
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).single()

    // Permissions: gather from user_roles -> role_permissions -> permissions.
    // Roles are global now (no per-client scoping), so a single role assignment
    // fully defines what a user can do.
    const { data: roleRows } = await supabase.from('user_roles').select('role_id')
    const roleIds = (roleRows ?? []).map(r => r.role_id)
    let perms = new Set<string>()
    if (profile?.is_platform_admin) {
      const { data: allPerms } = await supabase.from('permissions').select('key')
      perms = new Set((allPerms ?? []).map(p => p.key))
    } else if (roleIds.length) {
      const { data: rp } = await supabase.from('role_permissions')
        .select('permissions(key)').in('role_id', roleIds)
      perms = new Set((rp ?? []).flatMap(r => r.permissions ? [r.permissions.key] : []))
    }

    set({
      profile: profile ?? null,
      permissions: perms,
      isPlatformAdmin: !!profile?.is_platform_admin,
      contextReady: true
    })
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    await get().loadContext()
    return {}
  },

  signOut: async () => { await supabase.auth.signOut() },

  can: (perm) => get().isPlatformAdmin || get().permissions.has(perm)
}))
