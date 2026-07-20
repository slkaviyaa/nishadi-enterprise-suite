'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="card w-96 bg-white dark:bg-gray-800 shadow-2xl animate-bounceIn">
        <div className="card-body">
          <h2 className="card-title text-2xl justify-center mb-4 text-gray-900 dark:text-white">Nishadi Motors POS</h2>
          {error && <div className="alert alert-error mb-4">{error}</div>}
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" className="input input-bordered w-full mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="input input-bordered w-full mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" className="btn btn-primary w-full transition-transform hover:scale-105 active:scale-95">Sign In</button>
          </form>
        </div>
      </div>
    </div>
  )
}