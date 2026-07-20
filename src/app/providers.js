'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Login from '@/components/Login'
import Sidebar from '@/components/Sidebar'

export function Providers({ children }) {
  const [session, setSession] = useState(null)
  const [branch, setBranch] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        supabase.from('staff').select('*').eq('id', data.session.user.id).single()
          .then(({ data: staff }) => {
            if (staff) { setBranch(staff.branch_id); setUser(staff) }
            setLoading(false)
          })
      } else setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!session) return <Login />
  if (!branch) return <div className="alert alert-error m-4">No branch assigned. Contact admin.</div>

  return (
    <div className="flex h-screen">
      <Sidebar user={user} branch={branch} />
      <main className="flex-1 overflow-auto bg-base-200 p-6">
        {React.cloneElement(children, { branch, user })}
      </main>
    </div>
  )
}