'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { DEFAULT_BRANCH_ID } from '../lib/branches'
import Login from '../components/Login'
import MainLayout from '../components/MainLayout'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const pathname = usePathname()
  const [session, setSession] = useState(null)
  const [branch, setBranch] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const publicRoutes = ['/', '/signup']
  const isPublic = publicRoutes.includes(pathname)

  const loadCurrentUser = async (authSession) => {
    if (!authSession?.access_token) {
      setBranch(null)
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/current-user', {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      })
      const result = await response.json()

      if (!response.ok || !result.user) {
        console.error('Current user lookup failed:', result.error || response.statusText)
        setUser(null)
        setBranch(null)
        setLoading(false)
        return
      }

      const staff = result.user
      setUser(staff)
      setBranch(staff.branch_id || DEFAULT_BRANCH_ID)
    } catch (error) {
      console.error('Current user request failed:', error)
      setUser(null)
      setBranch(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      loadCurrentUser(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      loadCurrentUser(nextSession)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async (inviteCode = null) => {
    let redirectTo = `${window.location.origin}/auth/callback`
    if (inviteCode) redirectTo += `?invite_code=${encodeURIComponent(inviteCode)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
  }

  const signOut = () => supabase.auth.signOut()

  if (loading) return <div className="flex h-screen items-center justify-center font-medium">Loading...</div>

  if (session && user && branch) {
    return (
      <AuthContext.Provider value={{ branch, user, signInWithGoogle, signOut }}>
        <MainLayout>{children}</MainLayout>
      </AuthContext.Provider>
    )
  }

  if (isPublic) {
    return (
      <AuthContext.Provider value={{ branch: null, user: null, signInWithGoogle, signOut }}>
        {pathname === '/' ? <Login /> : children}
      </AuthContext.Provider>
    )
  }

  return <Login />
}

export const useAuth = () => useContext(AuthContext)
