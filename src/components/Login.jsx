'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Link from 'next/link'
import { FcGoogle } from 'react-icons/fc'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const auth = useAuth()
  const signInWithGoogle = auth?.signInWithGoogle

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    let emailToUse = identifier
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

    const { error } = await supabase.auth.signInWithPassword({ email: emailToUse, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setError('Google sign in failed')
    }
    setGoogleLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white dark:bg-gray-800/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-white dark:bg-gray-800/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white dark:bg-gray-800/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 animate-bounceIn">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white dark:bg-gray-800/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
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
              placeholder="Email or Username"
              className="w-full bg-white dark:bg-gray-800/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full bg-white dark:bg-gray-800/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white dark:bg-gray-800 text-purple-700 font-bold py-3 rounded-xl hover:bg-gray-100 dark:bg-gray-700 transition disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-white/20"></div>
            <span className="px-3 text-white/60 text-sm">OR</span>
            <div className="flex-1 border-t border-white/20"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-100 dark:bg-gray-700 transition disabled:opacity-50"
          >
            <FcGoogle size={20} />
            {googleLoading ? 'Redirecting...' : 'Sign in with Google'}
          </button>
          <p className="text-center text-white/50 text-xs mt-2">Only for existing Google accounts</p>

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