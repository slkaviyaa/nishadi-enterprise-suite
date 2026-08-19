'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabaseClient'
import { BRANCHES, getBranchLabel } from '../lib/branches'
import PageTemplate from './PageTemplate'

const ALL_PERMISSIONS = [
  'pos.read', 'pos.write', 'inventory.read', 'inventory.write',
  'customers.read', 'customers.write', 'reports.read', 'staff.read',
  'accounting.read', 'accounting.write'
]

export default function Users() {
  const { user, branch } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('cashier')
  const [branchId, setBranchId] = useState(BRANCHES.MAIN)
  const [permissions, setPermissions] = useState([])
  
  const [loading, setLoading] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { 
    if (branch !== BRANCHES.PARALLEL) {
      loadUsers() 
    }
  }, [branch])

  const loadUsers = async () => {
    const { data, error } = await supabase.from('staff').select('*')
    if (error) showToast('Unable to load users', 'error')
    setUsers(data || [])
  }

  const handleCreate = async () => {
    if (!username || !password) { showToast('Username and password required', 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password, 
          branch_id: branchId || null, 
          role, 
          permissions, 
          display_name: username 
        })
      })
      const result = await res.json()
      if (!res.ok || result.error) throw new Error(result.error || 'Failed to create user')
      
      showToast('User created!', 'success')
      setUsername('')
      setPassword('')
      setPermissions([])
      setShowCreate(false)
      loadUsers()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (u) => setEditUser({ 
    id: u.id, 
    username: u.username || u.display_name || '', 
    role: u.role || 'cashier', 
    branch_id: u.branch_id || BRANCHES.MAIN, 
    permissions: u.permissions || [] 
  })

  const handleUpdate = async () => {
    if (!editUser.username) { showToast('Username is required', 'error'); return }
    setLoading(true)
    try {
      const payload = {
        userId: editUser.id,
        username: editUser.username,
        role: editUser.role,
        branch_id: editUser.branch_id || null,
        permissions: editUser.permissions || []
      }
      
      if (editUser.password && editUser.password.trim() !== '') {
        payload.password = editUser.password
      }

      const res = await fetch('/api/update-user', {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const result = await res.json()
      
      if (!res.ok || result.error) {
        throw new Error(result.error || `Server error: ${res.status}`)
      }
      
      showToast('User updated successfully!', 'success')
      setEditUser(null)
      loadUsers()
    } catch (err) {
      console.error('Update user error:', err)
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (userId) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    try {
      const res = await fetch('/api/delete-user', { 
        method: 'DELETE', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ userId }) 
      })
      const result = await res.json()
      if (!res.ok || result.error) throw new Error(result.error || 'Failed to delete user')
      
      showToast('User deleted!', 'success')
      loadUsers()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // 🔴 Parallel Branch Guard (Owner ට වුණත් Page එක Block කිරීම)
  if (branch === BRANCHES.PARALLEL) {
    return (
      <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-red-200 dark:border-red-900 max-w-lg mx-auto mt-10">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="text-xl font-extrabold text-red-600 dark:text-red-400 mb-2">
          Access Restricted for Parallel Branch
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Parallel branch එකෙන් Users ලා කළමනාකරණය කිරීමට අවසර නැත. Users ලා එකතු කිරීම Main Branch එකෙන් පමණක් සිදු කළ හැක.
        </p>
      </div>
    )
  }

  if (user?.role !== 'owner') return <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>

  return (
    <div className="space-y-6 text-gray-900 dark:text-white pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 transition" onClick={() => setShowCreate(true)}>
          + Create User
        </button>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left bg-gray-50 dark:bg-gray-700/50">
              <th className="p-4 text-sm font-bold text-gray-600 dark:text-gray-300">Username</th>
              <th className="p-4 text-sm font-bold text-gray-600 dark:text-gray-300">Role</th>
              <th className="p-4 text-sm font-bold text-gray-600 dark:text-gray-300">Branch</th>
              <th className="p-4 text-sm font-bold text-gray-600 dark:text-gray-300">Permissions</th>
              <th className="p-4 text-sm font-bold text-gray-600 dark:text-gray-300 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">No users found.</td></tr> : users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="p-4 text-sm font-semibold">{u.username || u.display_name}</td>
                <td className="p-4 text-sm capitalize">{u.role}</td>
                <td className="p-4 text-sm">{getBranchLabel(u.branch_id)}</td>
                <td className="p-4 text-sm">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {(u.permissions || []).slice(0, 3).map(p => <span key={p} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded text-[10px] font-bold uppercase">{p.replace('.',' ')}</span>)}
                    {(u.permissions || []).length > 3 && <span className="text-[10px] text-gray-400 font-bold ml-1 self-center">+{u.permissions.length - 3} more</span>}
                  </div>
                </td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => startEdit(u)} className="px-3 py-1.5 text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg transition">✏️ Edit</button>
                    <button onClick={() => handleDelete(u.id)} className="px-3 py-1.5 text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg transition">🗑️ Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md animate-scaleIn border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-lg mb-4">Create New User</h3>
            <div className="space-y-4">
              <input className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2 text-sm" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
              <input className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2 text-sm" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              <select className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2 text-sm" value={role} onChange={e => setRole(e.target.value)}>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="accountant">Accountant</option>
              </select>
              <select className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2 text-sm" value={branchId} onChange={e => setBranchId(e.target.value)}>
                <option value={BRANCHES.MAIN}>Main Branch</option>
                <option value={BRANCHES.PARALLEL}>Parallel Branch</option>
                <option value="">No Specific Branch</option>
              </select>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Permissions</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {ALL_PERMISSIONS.map(p => (
                    <button key={p} onClick={() => setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} className={`text-[11px] font-bold px-2 py-2 rounded-lg transition-colors border ${permissions.includes(p) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                      {p.replace('.',' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow transition" onClick={handleCreate} disabled={loading}>
                {loading ? 'Creating...' : 'Create User'}
              </button>
              <button className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold text-sm rounded-lg transition" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md animate-scaleIn border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-lg mb-4">Edit User: {editUser.username}</h3>
            <div className="space-y-4">
              <input className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2 text-sm" placeholder="Username" value={editUser.username} onChange={e => setEditUser({ ...editUser, username: e.target.value })} />
              <input type="password" className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2 text-sm" placeholder="New Password (leave blank to keep)" value={editUser.password || ''} onChange={e => setEditUser({ ...editUser, password: e.target.value })} />
              <select className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2 text-sm" value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="accountant">Accountant</option>
              </select>
              <select className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2 text-sm" value={editUser.branch_id || ''} onChange={e => setEditUser({ ...editUser, branch_id: e.target.value })}>
                <option value={BRANCHES.MAIN}>Main Branch</option>
                <option value={BRANCHES.PARALLEL}>Parallel Branch</option>
                <option value="">No Specific Branch</option>
              </select>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Permissions</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {ALL_PERMISSIONS.map(p => (
                    <button key={p} onClick={() => setEditUser({ ...editUser, permissions: editUser.permissions.includes(p) ? editUser.permissions.filter(x => x !== p) : [...editUser.permissions, p] })} className={`text-[11px] font-bold px-2 py-2 rounded-lg transition-colors border ${editUser.permissions.includes(p) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                      {p.replace('.',' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow transition" onClick={handleUpdate} disabled={loading}>
                {loading ? 'Updating...' : 'Save Changes'}
              </button>
              <button className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold text-sm rounded-lg transition" onClick={() => setEditUser(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}