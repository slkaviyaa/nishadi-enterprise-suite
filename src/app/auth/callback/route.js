import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/login?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { 
          return cookieStore.get(name)?.value 
        },
        set(name, value, options) { 
          try {
            cookieStore.set({ name, value, ...options }) 
          } catch (error) {
            // Handle cookie setting error
          }
        },
        remove(name, options) { 
          try {
            cookieStore.set({ name, value: '', ...options }) 
          } catch (error) {
            // Handle cookie removal error
          }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  
  if (error) {
    return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`)
  }

  // Success unama root path ekata (dashboard/home) redirect karai
  return NextResponse.redirect(`${requestUrl.origin}/`)
}