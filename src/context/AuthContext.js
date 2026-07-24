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
      if (data.session) loadStaff(data.session.user.id)
      else setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) loadStaff(session.user.id)
      else { setBranch(null); setUser(null); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const loadStaff = async (userId) => {
    // Use RPC function (bypasses PostgREST 406)
    const { data, error } = await supabase.rpc('get_staff_by_id', { user_id: userId })
    if (error) {
      console.error('Staff load error:', error)
      setLoading(false)
      return
    }
    if (data && data.length > 0) {
      setBranch(data[0].branch_id)
      setUser(data[0])
    }
    setLoading(false)
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-2xl">Loading...</div>

  if (session) {
    if (!branch) return <div className="alert alert-error m-4">No branch assigned. Contact admin.</div>
    return (
      <AuthContext.Provider value={{ branch, user }}>
        <MainLayout>{children}</MainLayout>
      </AuthContext.Provider>
    )
  }

  if (isPublic) {
    return (
      <AuthContext.Provider value={{ branch: null, user: null }}>
        {pathname === '/' ? <Login /> : children}
      </AuthContext.Provider>
    )
  }

  return <Login />
}

export const useAuth = () => useContext(AuthContext)