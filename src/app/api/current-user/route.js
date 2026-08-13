export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff, error: staffError } = await supabaseAdmin
    .from('staff')
    .select('id, branch_id, username, display_name, role, permissions')
    .eq('id', authUser.id)
    .maybeSingle()

  if (staffError) {
    console.error('current-user staff lookup failed:', staffError)
    return Response.json({ error: staffError.message }, { status: 500 })
  }

  if (!staff) return Response.json({ error: 'Staff profile not found' }, { status: 404 })

  return Response.json({ user: staff })
}
