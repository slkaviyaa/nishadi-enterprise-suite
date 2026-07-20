'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

const ALL_PERMISSIONS = [
  'pos.read', 'pos.write', 'inventory.read', 'inventory.write',
  'customers.read', 'customers.write', 'reports.read', 'staff.read',
  'accounting.read', 'accounting.write'
]

export default function Users() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('cashier')
  const [branchId, setBranchId] = useState('11111111-1111-1111-1111-111111111111')
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    const { data } = await supabase.from('staff').select('*')
    setUsers(data || [])
  }

  const handleCreate = async () => {
    if (!email || !password) return alert('Email and password required')
    setLoading(true)
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, branch_id: branchId, role, permissions, display_name: email })
    })
    const result = await res.json()
    if (result.error) alert(result.error)
    else { alert('User created!'); setEmail(''); setPassword(''); setPermissions([]); loadUsers() }
    setLoading(false)
  }

  if (user?.role !== 'owner') return <div className="alert alert-error">Access Denied</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">User Management</h2>

      <div className="card bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="font-semibold mb-4 text-lg">Create New User</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input className="input input-bordered bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="input input-bordered bg-white dark:bg-gray-700 text-gray-900 dark:text-white" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <select className="select select-bordered bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={role} onChange={e => setRole(e.target.value)}>
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
            <option value="accountant">Accountant</option>
          </select>
          <select className="select select-bordered bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="11111111-1111-1111-1111-111111111111">Main</option>
            <option value="22222222-2222-2222-2222-222222222222">Parallel</option>
          </select>
        </div>

        {/* Permissions with Plain Toggle Buttons */}
        <label className="font-medium mb-2 block text-gray-700 dark:text-gray-200">Permissions</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {ALL_PERMISSIONS.map(p => (
            <button
              key={p}
              onClick={() => setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
              className={`text-sm px-3 py-1 rounded-full transition-colors ${
                permissions.includes(p) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead><tr><th>Email</th><th>Role</th><th>Branch</th><th>Permissions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.display_name || u.id}</td>
                <td>{u.role}</td>
                <td>{u.branch_id === '11111111-1111-1111-1111-111111111111' ? 'Main' : 'Parallel'}</td>
                <td className="text-sm">{(u.permissions || []).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}