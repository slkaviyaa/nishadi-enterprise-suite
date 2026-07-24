import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function DELETE(request) {
  const { userId } = await request.json()

  // Delete staff record first (foreign key to auth.users)
  const { error: staffError } = await supabaseAdmin
    .from('staff')
    .delete()
    .eq('id', userId)

  if (staffError) return Response.json({ error: staffError.message }, { status: 400 })

  // Delete auth user
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authError) return Response.json({ error: authError.message }, { status: 400 })

  return Response.json({ success: true })
}