import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const { userId, otp } = await request.json()

  // 1. Fetch staff record
  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('otp, otp_expires_at')
    .eq('id', userId)
    .single()

  if (!staff || !staff.otp) return Response.json({ error: 'No OTP found' }, { status: 400 })

  // 2. Check expiration
  if (new Date(staff.otp_expires_at) < new Date()) {
    return Response.json({ error: 'OTP expired' }, { status: 400 })
  }

  // 3. Verify OTP
  if (staff.otp !== otp.trim()) {
    return Response.json({ error: 'Invalid OTP' }, { status: 400 })
  }

  // 4. Confirm email in Supabase Auth
  await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true })

  // 5. Clear OTP
  await supabaseAdmin.from('staff').update({ otp: null, otp_expires_at: null }).eq('id', userId)

  return Response.json({ success: true, message: 'Email verified! You can now sign in.' })
}