'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadUser(data.session.user.id)
      else setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) loadUser(session.user.id)
      else { setBranch(null); setUser(null); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const loadUser = async (userId) => {
    const { data: staff } = await supabase.from('staff')
      .select('id, branch_id, username')
      .eq('id', userId)
      .maybeSingle()
    if (staff) {
      setUser(staff)
      setBranch(staff.branch_id)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase.from('profiles')
      .select('id, branch_id, display_name')
      .eq('id', userId)
      .maybeSingle()
    if (profile) {
      setUser(profile)
      setBranch(profile.branch_id)
    } else {
      setUser(null)
      setBranch(null)
    }
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

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>

  if (session) {
    if (!branch) return <div className="alert alert-error m-4">No branch assigned. Contact admin.</div>
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