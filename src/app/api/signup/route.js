import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString()

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

  // 2. Create auth user (email_confirm: false)
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false
  })
  if (authError) return Response.json({ error: authError.message }, { status: 400 })

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

  // 4. Generate OTP + save
  const otp = generateOTP()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

  await supabaseAdmin
    .from('staff')
    .update({ otp, otp_expires_at: expiresAt })
    .eq('id', authUser.user.id)

  // 5. Send OTP email
  try {
    await resend.emails.send({
      from: 'Nishadi Motors <noreply@yourdomain.com>',
      to: email,
      subject: 'Your Verification Code',
      html: `<p>Your verification code is: <strong>${otp}</strong></p><p>Expires in 10 minutes.</p>`
    })
  } catch (err) {
    console.error('Email send error:', err)
    // Still return success, but note email may not arrive
  }

  return Response.json({ success: true, message: 'Verification code sent to your email.' })
}