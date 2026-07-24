'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

export default function Login() {
  const [identifier, setIdentifier] = useState('')   // email or username
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 1. Verify invite code
    const res = await fetch('/api/verify-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCode })
    })
    const { valid, error: inviteError } = await res.json()
    if (!valid) {
      setError(inviteError || 'Invalid invite code')
      setLoading(false)
      return
    }

    let emailToUse = identifier

    // 2. If not an email (no '@'), treat as username
    if (!identifier.includes('@')) {
      const { data: staffData } = await supabase
        .from('staff')
        .select('username')
        .eq('username', identifier)
        .maybeSingle()

      if (!staffData) {
        setError('Invalid username or email')
        setLoading(false)
        return
      }
      emailToUse = `${staffData.username}@nishadi.internal`
    }

    // 3. Sign in
    const { error } = await supabase.auth.signInWithPassword({ email: emailToUse, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 animate-bounceIn">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-4xl">🚛</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Nishadi Motors</h1>
            <p className="text-white/70 mt-1">Enterprise POS System</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-white px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="Invite Code (Security Key)"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Email or Username"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-purple-700 font-bold py-3 rounded-xl hover:bg-gray-100 transition disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-white/70 text-sm mt-6">
            Don't have an account?{' '}
            <Link href="/signup" className="text-white font-medium hover:underline">
              Sign Up
            </Link>
          </p>
        </div>

        <p className="text-center text-white/50 text-sm mt-6">
          Designed & Developed by <span className="text-white/80 font-medium">Ceylon Digi Solutions</span>
        </p>
      </div>
    </div>
  )
}