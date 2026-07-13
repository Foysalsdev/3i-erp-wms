import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // Verify the caller is a platform admin.
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uerr } = await caller.auth.getUser()
    if (uerr || !user) return json(401, { error: 'Not authenticated' })

    const admin = createClient(url, serviceKey)
    const { data: prof } = await admin.from('profiles').select('is_platform_admin').eq('id', user.id).single()
    if (!prof?.is_platform_admin) return json(403, { error: 'Only a platform admin can create users' })

    const body = await req.json()
    const { email, password, full_name, designation, division, role_id } = body ?? {}
    if (!email || !password) return json(400, { error: 'email and password are required' })
    if (String(password).length < 6) return json(400, { error: 'Password must be at least 6 characters' })

    // Create the auth login (email pre-confirmed so they can sign in immediately).
    const { data: created, error: cerr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name }
    })
    if (cerr) return json(400, { error: cerr.message })
    const newId = created.user!.id

    // Profile (an on_auth_user_created trigger may have created it) — set details.
    await admin.from('profiles').upsert({
      id: newId, email, full_name: full_name ?? null,
      designation: designation ?? null, division: division ?? null, status: 'active'
    }, { onConflict: 'id' })

    // Assign the global role (single-tenant: a role fully defines the user's access).
    if (role_id) {
      await admin.from('user_roles').delete().eq('user_id', newId)
      await admin.from('user_roles').insert({ user_id: newId, role_id })
    }

    return json(200, { ok: true, user_id: newId })
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) })
  }
})
