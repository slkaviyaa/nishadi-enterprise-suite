'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { FcGoogle } from 'react-icons/fc'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const auth = useAuth()
  const signInWithGoogle = auth?.signInWithGoogle

  const handleEmailSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          display_name: displayName.trim(),
          invite_code: inviteCode.trim()
        })
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setMessage('Account created! You can now sign in.')
        setEmail(''); setPassword(''); setDisplayName(''); setInviteCode('')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  const handleGoogleSignup = async () => {
    if (!inviteCode.trim()) {
      setError('Invite code is required for Google signup')
      return
    }
    try {
      const res = await fetch('/api/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() })
      })
      const { valid, error: inviteError } = await res.json()
      if (!valid) {
        setError(inviteError || 'Invalid invite code')
        return
      }
      setError('')
      // Pass invite_code to signInWithGoogle so callback route can map the branch/profile
      await signInWithGoogle(inviteCode.trim())
    } catch (err) {
      setError('Something went wrong')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white dark:bg-gray-800/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-white dark:bg-gray-800/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition">
          ← Back to Login
        </Link>

        <div className="bg-white dark:bg-gray-800/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-white dark:bg-gray-800/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-4xl">🚛</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Create Account</h1>
            <p className="text-white/70 mt-1">Nishadi Motors POS</p>
          </div>

          {error && <div className="bg-red-500/20 border border-red-400/30 text-white px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
          {message && <div className="bg-green-500/20 border border-green-400/30 text-white px-4 py-3 rounded-xl mb-4 text-sm">
            {message} <Link href="/" className="font-bold underline">Go to Sign In</Link>
          </div>}

          <div className="space-y-4">
            <input type="text" placeholder="Invite Code (Security Key)" className="w-full bg-white dark:bg-gray-800/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
              value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />

            <form onSubmit={handleEmailSignup} className="space-y-4">
              <input type="text" placeholder="Display Name" className="w-full bg-white dark:bg-gray-800/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                value={displayName} onChange={e => setDisplayName(e.target.value)} required />
              <input type="email" placeholder="Email address" className="w-full bg-white dark:bg-gray-800/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" className="w-full bg-white dark:bg-gray-800/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="submit" disabled={loading}
                className="w-full bg-white dark:bg-gray-800 text-purple-700 font-bold py-3 rounded-xl hover:bg-gray-100 dark:bg-gray-700 transition disabled:opacity-50">
                {loading ? 'Creating...' : 'Sign up with Email'}
              </button>
            </form>

            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-white/20"></div>
              <span className="px-3 text-white/60 text-sm">OR</span>
              <div className="flex-1 border-t border-white/20"></div>
            </div>

            <button onClick={handleGoogleSignup}
              className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-100 dark:bg-gray-700 transition">
              <FcGoogle size={20} />
              Sign up with Google
            </button>
            <p className="text-center text-white/50 text-xs">Google signup requires an invite code</p>
          </div>

          <p className="text-center text-white/70 text-sm mt-4">
            Already have an account?{' '}
            <Link href="/" className="text-white font-medium hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}