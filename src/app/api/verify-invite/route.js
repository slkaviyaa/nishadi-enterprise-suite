import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const { code } = await request.json()

  const { data: settings } = await supabase
    .from('branch_settings')
    .select('invite_code, branch_id')
    .eq('branch_id', '11111111-1111-1111-1111-111111111111')
    .maybeSingle()

  if (!settings || !settings.invite_code) {
    // Development bypass: allow any code
    return Response.json({ valid: true, branch_id: '11111111-1111-1111-1111-111111111111' })
  }

  if (settings.invite_code === code) {
    return Response.json({ valid: true, branch_id: settings.branch_id })
  } else {
    return Response.json({ valid: false, error: 'Invalid invite code' })
  }
}