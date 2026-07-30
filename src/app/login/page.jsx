'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function LoginRedirect() {
  const router = useRouter()
  useEffect(() => {
    if (window.location.hash) {
      const params = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = params.get('access_token')
      if (accessToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: params.get('refresh_token') || '',
        }).then(({ error }) => {
          if (error) console.error(error)
          else router.push('/')
        })
        return
      }
    }
    router.push('/')
  }, [router])
  return <div className="flex h-screen items-center justify-center">Signing in...</div>
}