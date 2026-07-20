import { createClient } from '@supabase/supabase-js'
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function POST(request) {
  const { email, password, branch_id, role, permissions, display_name } = await request.json()
  const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) return Response.json({ error: error.message }, { status: 400 })
  const { error: staffError } = await supabaseAdmin.from('staff').insert({ id: authUser.user.id, branch_id, role, display_name, permissions })
  if (staffError) return Response.json({ error: staffError.message }, { status: 400 })
  return Response.json({ success: true })
}