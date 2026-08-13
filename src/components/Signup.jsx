'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageTemplate from './PageTemplate';

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          invite_code: inviteCode
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Signup failed')
      }

      // සාර්ථකව අකවුන්ට් එක හැදුණු ගමන් කෙළින්ම Login පේජ් එකට යැවීම
      router.push('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-xl p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">Create Account</h2>
        {error && <div className="alert alert-error mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="label text-xs font-semibold">Display Name</label>
            <input 
              type="text" 
              className="input input-bordered w-full" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="label text-xs font-semibold">Email</label>
            <input 
              type="email" 
              className="input input-bordered w-full" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="label text-xs font-semibold">Password</label>
            <input 
              type="password" 
              className="input input-bordered w-full" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="label text-xs font-semibold">Invite Code</label>
            <input 
              type="text" 
              className="input input-bordered w-full font-mono" 
              value={inviteCode} 
              onChange={e => setInviteCode(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" className="btn btn-primary w-full mt-2" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="text-center mt-4 text-sm">
          Already have an account? <Link href="/login" className="text-primary underline">Login</Link>
        </div>
      </div>
    </div>
  )
}