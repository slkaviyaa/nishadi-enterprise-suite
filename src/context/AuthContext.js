'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import Login from '../components/Login'
import MainLayout from '../components/MainLayout'

const AuthContext = createContext(null)

// Default Branch ID for fallback (Main Branch)
const DEFAULT_BRANCH_ID = '11111111-1111-1111-1111-111111111111'

export function AuthProvider({ children }) {
  const pathname = usePathname()
  const [session, setSession] = useState(null)
  const [branch, setBranch] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const publicRoutes = ['/', '/signup']
  const isPublic = publicRoutes.includes(pathname)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadUser(data.session.user)
      else setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) loadUser(session.user)
      else { setBranch(null); setUser(null); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const loadUser = async (authUser) => {
    if (!authUser) {
      setLoading(false)
      return
    }

    const userId = authUser.id

    // 1. Check staff table first
    const { data: staff } = await supabase.from('staff')
      .select('id, branch_id, username, display_name, role, permissions')
      .eq('id', userId)
      .maybeSingle()

    if (staff) {
      setUser(staff)
      // Branch ID එක නැත්නම් Default Branch එක දානවා
      setBranch(staff.branch_id || DEFAULT_BRANCH_ID)
      setLoading(false)
      return
    }

    // 2. Check profiles table
    const { data: profile } = await supabase.from('profiles')
      .select('id, branch_id, display_name, role')
      .eq('id', userId)
      .maybeSingle()

    if (profile) {
      setUser({ ...profile, role: profile.role || 'owner' })
      setBranch(profile.branch_id || DEFAULT_BRANCH_ID)
      setLoading(false)
      return
    }

    // 3. Database එකේ නැති අලුත් User කෙනෙක් නම්, Default Fallback User Profile එකක් සෙට් කරලා Dashboard එක ඕපන් කරනවා
    const fallbackUser = {
      id: userId,
      display_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      role: 'owner',
      branch_id: DEFAULT_BRANCH_ID
    }

    setUser(fallbackUser)
    setBranch(DEFAULT_BRANCH_ID)
    setLoading(false)
  }

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

  if (session) {
    // No branch restriction check block anymore — defaults automatically
    return (
      <AuthContext.Provider value={{ branch: branch || DEFAULT_BRANCH_ID, user, signInWithGoogle, signOut }}>
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