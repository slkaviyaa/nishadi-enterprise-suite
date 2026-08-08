'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [token, setToken] = useState('') // Verification OTP code එක සඳහා
  const [step, setStep] = useState('signup') // 'signup' හෝ 'verify'
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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
        setMessage('Account created successfully! Please enter the verification code sent to your email.')
        setStep('verify') // ඊළඟට OTP කෝඩ් එක දාන පියවරට මාරු වීම
      }
    } catch (err) {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  // 🟢 Verification OTP කෝඩ් එක Check කරන කොටස
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'signup'
      })

      if (error) {
        setError(error.message)
      } else {
        setMessage('Email verified successfully! Redirecting to POS...')
        setTimeout(() => {
          router.push('/pos')
        }, 1500)
      }
    } catch (err) {
      setError('Verification failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition font-medium">
          ← Back to Login
        </Link>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-4xl">🚛</span>
            </div>
            <h1 className="text-3xl font-bold text-white">
              {step === 'signup' ? 'Create Account' : 'Verify Email'}
            </h1>
            <p className="text-white/70 mt-1">Nishadi Motors POS</p>
          </div>

          {error && <div className="bg-red-500/20 border border-red-400/30 text-white px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
          {message && <div className="bg-green-500/20 border border-green-400/30 text-white px-4 py-3 rounded-xl mb-4 text-sm">{message}</div>}

          {/* පියවර 1: Signup Form එක */}
          {step === 'signup' && (
            <form onSubmit={handleEmailSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">Invite Code (Security Key)</label>
                <input type="text" placeholder="Enter Invite Code" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                  value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">Display Name</label>
                <input type="text" placeholder="Your Name" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                  value={displayName} onChange={e => setDisplayName(e.target.value)} required />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">Email Address</label>
                <input type="email" placeholder="name@example.com" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">Password</label>
                <input type="password" placeholder="••••••••" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                  value={password} onChange={e => setPassword(e.target.value)} required />
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-white text-purple-700 font-bold py-3.5 rounded-xl hover:bg-gray-100 transition shadow-lg disabled:opacity-50 mt-2">
                {loading ? 'Creating Account...' : 'Sign up'}
              </button>
            </form>
          )}

          {/* පියවර 2: OTP Verification Form එක */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">Enter 6-Digit Verification Code</label>
                <input type="text" placeholder="123456" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest placeholder-white/60 focus:outline-none focus:border-white/50 transition"
                  value={token} onChange={e => setToken(e.target.value)} required maxLength={6} />
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 transition shadow-lg disabled:opacity-50 mt-2">
                {loading ? 'Verifying...' : 'Verify Code & Proceed'}
              </button>
            </form>
          )}

          <p className="text-center text-white/70 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/" className="text-white font-semibold underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}