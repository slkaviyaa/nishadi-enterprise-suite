export const dynamic = 'force-static'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const { username, password, branch_id, role, permissions, display_name } = await request.json()

  // Generate a hidden email for Supabase auth (username@nishadi.internal)
  const hiddenEmail = `${username}@nishadi.internal`

  // 1. Create auth user with hidden email
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: hiddenEmail,
    password,
    email_confirm: true
  })
  if (authError) return Response.json({ error: authError.message }, { status: 400 })

  // 2. Insert staff record with username
  const { error: staffError } = await supabaseAdmin
    .from('staff')
    .insert({
      id: authUser.user.id,
      branch_id,
      role,
      permissions,
      display_name: display_name || username,
      username
    })

  if (staffError) return Response.json({ error: staffError.message }, { status: 400 })

  return Response.json({ success: true, userId: authUser.user.id })
}