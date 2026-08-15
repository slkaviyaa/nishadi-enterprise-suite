export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function PUT(request) {
  try {
    const { userId, username, password, role, branch_id, permissions } = await request.json()
  try {
    const { userId, username, password, role, branch_id, permissions } = await request.json()

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Prepare update payload (Handle empty branch_id properly to prevent foreign key violation)
    const updateData = {
      username,
      role,
      permissions,
      branch_id: branch_id && branch_id !== '' ? branch_id : null
    }

    // Update staff record
    const { error: staffError } = await supabaseAdmin
      .from('staff')
      .update(updateData)
      .eq('id', userId)

    if (staffError) return Response.json({ error: staffError.message }, { status: 400 })

    // If password provided, update auth user password
    if (password && password.trim() !== '') {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
      if (authError) return Response.json({ error: authError.message }, { status: 400 })
    }

    // If username changed, update hidden email accordingly
    if (username) {
      const hiddenEmail = `${username.trim().toLowerCase()}@nishadi.internal`
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: hiddenEmail })
      if (emailError) return Response.json({ error: emailError.message }, { status: 400 })
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
