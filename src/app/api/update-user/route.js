import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function PUT(request) {
  const { userId, username, password, role, branch_id, permissions } = await request.json()

  // Update staff record (username, role, branch, permissions)
  const { error: staffError } = await supabaseAdmin
    .from('staff')
    .update({ username, role, branch_id, permissions })
    .eq('id', userId)

  if (staffError) return Response.json({ error: staffError.message }, { status: 400 })

  // If password provided, update auth user password
  if (password) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
    if (authError) return Response.json({ error: authError.message }, { status: 400 })
  }

  // If username changed, update hidden email accordingly
  if (username) {
    const hiddenEmail = `${username}@nishadi.internal`
    const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: hiddenEmail })
    if (emailError) return Response.json({ error: emailError.message }, { status: 400 })
  }

  return Response.json({ success: true })
}