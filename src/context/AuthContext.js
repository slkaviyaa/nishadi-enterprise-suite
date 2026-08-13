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

  useEffect(() => {
    let mounted = true

    const loadCurrentUser = async (authUser) => {
      if (!authUser) {
        if (mounted) {
          setBranch(null)
          setUser(null)
          setLoading(false)
        }
        return
      }

      // staff is the canonical application identity. Do not silently turn an
      // unreadable/missing staff row into an owner on Main Branch.
      const { data: staff, error } = await supabase
        .from('staff')
        .select('id, branch_id, username, display_name, role, permissions')
        .eq('id', authUser.id)
        .maybeSingle()

      if (!mounted) return

      if (error) {
        console.error('Unable to load staff profile:', error)
        setUser(null)
        setBranch(null)
        setLoading(false)
        return
      }

      if (!staff) {
        console.error('Authenticated user has no staff record:', authUser.id)
        setUser(null)
        setBranch(null)
        setLoading(false)
        return
      }

      setUser(staff)
      setBranch(staff.branch_id || DEFAULT_BRANCH_ID)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      loadCurrentUser(data.session?.user || null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      loadCurrentUser(nextSession?.user || null)
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
