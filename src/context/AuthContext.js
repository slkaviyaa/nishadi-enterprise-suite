'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Login from '../components/Login'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [branch, setBranch] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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
    const { data } = await supabase.from('staff').select('*').eq('id', userId).single()
    if (data) { setBranch(data.branch_id); setUser(data) }
    setLoading(false)
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-2xl">Loading...</div>
  if (!session) return <Login />
  if (!branch) return <div className="alert alert-error m-4">No branch assigned. Contact admin.</div>

  return (
    <AuthContext.Provider value={{ branch, user, permissions: user?.permissions || [] }}>
  {children}
</AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)