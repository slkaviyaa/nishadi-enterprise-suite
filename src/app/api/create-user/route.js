export const dynamic = 'force-static'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { username, password, branch_id, role, permissions, display_name } = await request.json()

    if (!username || !password) {
      return Response.json({ error: 'Username and password are required' }, { status: 400 })
    }

    // Fix 1: Remove all spaces and convert to lowercase for a valid hidden email format
    const safeUsername = username.trim().toLowerCase().replace(/\s+/g, '')
    const hiddenEmail = `${safeUsername}@nishadi.internal`

    let userId = null

    // 1. Try to create auth user with hidden email
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: hiddenEmail,
      password,
      email_confirm: true
    })

    if (authError) {
      // If user already exists in Supabase Auth, fetch their existing ID and update password
      if (authError.message.includes('already been registered')) {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        if (listError) return Response.json({ error: listError.message }, { status: 400 })

        const existingUser = users.find(u => u.email === hiddenEmail)
        if (existingUser) {
          userId = existingUser.id
          // Update password for the existing auth user
          await supabaseAdmin.auth.admin.updateUserById(userId, { password })
        } else {
          return Response.json({ error: authError.message }, { status: 400 })
        }
      } else {
        return Response.json({ error: authError.message }, { status: 400 })
      }
    } else {
      userId = authUser.user.id
    }

    // Fix 2: Handle empty string branch_id converting it to null to prevent UUID type errors
    const cleanBranchId = branch_id && branch_id !== '' ? branch_id : null;

    // 2. Insert or Update staff record using UPSERT to prevent primary key conflicts
    const { error: staffError } = await supabaseAdmin
      .from('staff')
      .upsert({
        id: userId,
        branch_id: cleanBranchId,
        role,
        permissions,
        display_name: display_name || username,
        username
      }, { onConflict: 'id' })

    if (staffError) {
      return Response.json({ error: staffError.message }, { status: 400 })
    }

    return Response.json({ success: true, userId })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}