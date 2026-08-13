export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function PUT(request) {
  try {
    const { userId, username, password, role, branch_id, permissions } = await request.json()

    if (!userId) return Response.json({ error: 'User ID is required' }, { status: 400 })

    const nextUsername = typeof username === 'string' ? username.trim() : ''

    // Prevent two staff records from sharing the same username.
    if (nextUsername) {
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from('staff')
        .select('id')
        .eq('username', nextUsername)
        .neq('id', userId)
        .limit(1)
        .maybeSingle()

      if (duplicateError) {
        return Response.json({ error: `Username check failed: ${duplicateError.message}` }, { status: 400 })
      }
      if (duplicate) {
        return Response.json({ error: 'Username is already in use.' }, { status: 400 })
      }
    }

    // Read the current staff record before updating it. This lets us avoid
    // changing the hidden Supabase Auth email when the username did not change.
    const { data: currentStaff, error: currentStaffError } = await supabaseAdmin
      .from('staff')
      .select('id, username')
      .eq('id', userId)
      .maybeSingle()

    if (currentStaffError) {
      return Response.json({ error: `Unable to read staff record: ${currentStaffError.message}` }, { status: 400 })
    }
    if (!currentStaff) {
      return Response.json({ error: 'Staff record not found.' }, { status: 404 })
    }

    const staffPatch = {
      role,
      branch_id,
      permissions,
    }
    if (nextUsername) staffPatch.username = nextUsername

    const { error: staffError } = await supabaseAdmin
      .from('staff')
      .update(staffPatch)
      .eq('id', userId)

    if (staffError) return Response.json({ error: `Staff update failed: ${staffError.message}` }, { status: 400 })

    // Only touch Auth email when the username actually changed.
    if (nextUsername && nextUsername !== currentStaff.username) {
      const hiddenEmail = `${nextUsername}@nishadi.internal`
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: hiddenEmail })
      if (emailError) {
        // Revert staff username so DB/auth do not diverge.
        await supabaseAdmin.from('staff').update({ username: currentStaff.username }).eq('id', userId)
        return Response.json({ error: `Auth account update failed: ${emailError.message}` }, { status: 400 })
      }
    }

    if (password) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
      if (authError) return Response.json({ error: `Password update failed: ${authError.message}` }, { status: 400 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Update user error:', error)
    return Response.json({ error: error?.message || 'Unexpected server error' }, { status: 500 })
  }
}
