import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const inviteCode = requestUrl.searchParams.get('invite_code')

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value },
        set(name, value, options) { cookieStore.set({ name, value, ...options }) },
        remove(name, options) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  )

  if (code) {
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !session) {
      return NextResponse.redirect(requestUrl.origin + '/login?error=auth_failed')
    }

    if (session.user && inviteCode) {
      const res = await fetch(`${requestUrl.origin}/api/verify-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode }),
      })
      const { valid, branch_id } = await res.json()
      if (valid && branch_id) {
        const { createClient } = await import('@supabase/supabase-js')
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { autoRefreshToken: false } }
        )
        await adminClient.from('profiles').upsert({
          id: session.user.id,
          branch_id,
          display_name: session.user.user_metadata?.full_name || '',
        })
      }
    }

    return NextResponse.redirect(requestUrl.origin)
  }

  return NextResponse.redirect(requestUrl.origin + '/login?error=no_code')
}