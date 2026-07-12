import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

type Client = Tables<'clients'>
type Profile = Tables<'profiles'>

interface AuthState {
  session: Session | null
  profile: Profile | null
  clients: Client[]
  currentClientId: string | null
  permissions: Set<string>
  isPlatformAdmin: boolean
  loading: boolean
  // True once profile/clients/permissions have loaded for the current session.
  // The app must not enter the shell before this — otherwise the user sees a
  // permission-less flash ("Access restricted") and a cascade of loaders.
  contextReady: boolean
  init: () => Promise<void>
  loadContext: () => Promise<void>
  setClient: (id: string) => void
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  can: (perm: string) => boolean
}

const CLIENT_KEY = '3i_current_client'

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  clients: [],
  currentClientId: null,
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
      else set({ profile: null, clients: [], currentClientId: null, permissions: new Set(), contextReady: false })
    })
  },

  loadContext: async () => {
    const uid = get().session?.user.id
    if (!uid) return
    const [{ data: profile }, { data: uc }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('user_clients').select('client_id, is_default')
    ])

    // Resolve accessible clients (RLS already filters to permitted rows)
    const { data: clients } = await supabase.from('clients').select('*').order('name')
    const list = clients ?? []

    // Permissions: gather from user_roles -> role_permissions -> permissions
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

    const saved = localStorage.getItem(CLIENT_KEY)
    const def = (uc ?? []).find(c => c.is_default)?.client_id
    const current = (saved && list.some(c => c.id === saved)) ? saved : (def ?? list[0]?.id ?? null)

    set({
      profile: profile ?? null,
      clients: list,
      currentClientId: current,
      permissions: perms,
      isPlatformAdmin: !!profile?.is_platform_admin,
      contextReady: true
    })
  },

  setClient: (id) => { localStorage.setItem(CLIENT_KEY, id); set({ currentClientId: id }) },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    await get().loadContext()
    return {}
  },

  signOut: async () => { await supabase.auth.signOut(); localStorage.removeItem(CLIENT_KEY) },

  can: (perm) => get().isPlatformAdmin || get().permissions.has(perm)
}))
