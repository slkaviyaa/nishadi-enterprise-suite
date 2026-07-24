import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // Use service key to bypass RLS
)

export async function POST(request) {
  const { code } = await request.json()

  // Fetch invite code from Main Branch settings (change branch if needed)
  const { data: settings } = await supabase
    .from('branch_settings')
    .select('invite_code')
    .eq('branch_id', '11111111-1111-1111-1111-111111111111')
    .single()

  // If no invite code set yet (empty), allow login without code
  if (!settings || !settings.invite_code) {
    return Response.json({ valid: true })
  }

  // Compare
  if (settings.invite_code === code) {
    return Response.json({ valid: true })
  } else {
    return Response.json({ valid: false, error: 'Invalid invite code' })
  }
}