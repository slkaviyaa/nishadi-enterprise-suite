'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'  // to get userId after signup

export default function Signup() {
  const [step, setStep] = useState(1)               // 1 = form, 2 = OTP
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [otp, setOtp] = useState('')
  const [userId, setUserId] = useState(null)       // store after signup
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1: Submit signup form → send OTP
  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: displayName, invite_code: inviteCode })
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
      setLoading(false)
      return
    }

    // Store userId from response if available, otherwise fetch by email
    // We'll get userId from Supabase after signup
    const { data: userData } = await supabase
      .from('staff')
      .select('id')
      .eq('display_name', displayName || email)
      .maybeSingle()
    // Actually better to get userId from auth user via admin, but for demo use display_name
    setUserId(userData?.id)
    setMessage('Verification code sent to your email.')
    setStep(2)
    setLoading(false)
  }

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!userId) {
      setError('User ID not found. Please try signing up again.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, otp })
    })
    const data = await res.json()
    if (data.error) setError(data.error)
    else {
      setMessage('Email verified! You can now sign in.')
      setStep(3)   // success screen
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-4">
      {/* animated bg */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition">← Back to Login</Link>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 animate-bounceIn">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-4xl">🚛</span>
            </div>
            <h1 className="text-3xl font-bold text-white">
              {step === 3 ? 'Verified!' : 'Create Owner Account'}
            </h1>
            <p className="text-white/70 mt-1">Nishadi Motors POS</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-white px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>
          )}
          {message && (
            <div className="bg-green-500/20 border border-green-400/30 text-white px-4 py-3 rounded-xl mb-4 text-sm">{message}</div>
          )}

          {step === 1 && (
            <form onSubmit={handleSignup} className="space-y-4">
              <input type="text" placeholder="Display Name" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                value={displayName} onChange={e => setDisplayName(e.target.value)} required />
              <input type="email" placeholder="Email address" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                value={password} onChange={e => setPassword(e.target.value)} required />
              <input type="text" placeholder="Invite Code (Security Key)" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />
              <button type="submit" disabled={loading}
                className="w-full bg-white text-purple-700 font-bold py-3 rounded-xl hover:bg-gray-100 transition disabled:opacity-50">
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <p className="text-white/80 text-sm">Enter the 6‑digit code sent to <strong>{email}</strong></p>
              <input type="text" placeholder="123456" maxLength={6} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 text-center text-2xl tracking-widest focus:outline-none focus:border-white/50 transition"
                value={otp} onChange={e => setOtp(e.target.value)} required />
              <button type="submit" disabled={loading}
                className="w-full bg-white text-purple-700 font-bold py-3 rounded-xl hover:bg-gray-100 transition disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center">
              <p className="text-white/80 mb-4">Your email has been verified!</p>
              <Link href="/" className="inline-block bg-white text-purple-700 font-bold py-3 px-6 rounded-xl hover:bg-gray-100 transition">
                Sign In
              </Link>
            </div>
          )}

          {step === 1 && (
            <p className="text-center text-white/70 text-sm mt-4">
              Already have an account?{' '}
              <Link href="/" className="text-white font-medium hover:underline">Sign In</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}