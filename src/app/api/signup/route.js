import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const { email, password, display_name, invite_code } = await request.json()
  const branch_id = '11111111-1111-1111-1111-111111111111'

  // 1. Validate invite code
  const { data: branchSettings } = await supabaseAdmin
    .from('branch_settings')
    .select('invite_code')
    .eq('branch_id', branch_id)
    .single()

  if (!branchSettings || !branchSettings.invite_code || branchSettings.invite_code !== invite_code) {
    return Response.json({ error: 'Invalid invite code' }, { status: 400 })
  }

  // 2. Create auth user (instant confirm)
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true   // ← email confirm skip, instant login
  })
  if (authError) {
    if (authError.message.includes('already') || authError.message.includes('duplicate')) {
      return Response.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 400 })
    }
    return Response.json({ error: authError.message }, { status: 400 })
  }

  // 3. Insert staff record
  const { error: staffError } = await supabaseAdmin
    .from('staff')
    .insert({
      id: authUser.user.id,
      branch_id,
      role: 'owner',
      display_name: display_name || email,
      permissions: ['all']
    })

  if (staffError) return Response.json({ error: staffError.message }, { status: 400 })

  return Response.json({ success: true, message: 'Account created! You can now sign in.' })
}