'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabaseClient'

const ALL_PERMISSIONS = [
  'pos.read', 'pos.write',
  'inventory.read', 'inventory.write',
  'customers.read', 'customers.write',
  'reports.read', 'staff.read',
  'accounting.read', 'accounting.write'
]

export default function Users() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('cashier')
  const [branchId, setBranchId] = useState('11111111-1111-1111-1111-111111111111')
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [editUser, setEditUser] = useState(null) // { id, username, role, branch_id, permissions }
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    const { data } = await supabase.from('staff').select('*')
    setUsers(data || [])
  }

  // ---------- CREATE ----------
  const handleCreate = async () => {
    if (!username || !password) { showToast('Username and password required', 'error'); return }
    setLoading(true)
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        branch_id: branchId,
        role,
        permissions,
        display_name: username
      })
    })
    const result = await res.json()
    if (result.error) showToast(result.error, 'error')
    else {
      showToast('User created!')
      setUsername(''); setPassword(''); setPermissions([]); setShowCreate(false)
      loadUsers()
    }
    setLoading(false)
  }

  // ---------- EDIT ----------
  const startEdit = (u) => {
    setEditUser({
      id: u.id,
      username: u.username || '',
      role: u.role,
      branch_id: u.branch_id,
      permissions: u.permissions || []
    })
  }

  const handleUpdate = async () => {
    const res = await fetch('/api/update-user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: editUser.id,
        username: editUser.username,
        password: editUser.password || undefined, // only if changed
        role: editUser.role,
        branch_id: editUser.branch_id,
        permissions: editUser.permissions
      })
    })
    const result = await res.json()
    if (result.error) showToast(result.error, 'error')
    else { showToast('User updated!'); setEditUser(null); loadUsers() }
  }

  // ---------- DELETE ----------
  const handleDelete = async (userId) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    const res = await fetch('/api/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })
    const result = await res.json()
    if (result.error) showToast(result.error, 'error')
    else { showToast('User deleted!'); loadUsers() }
  }

  if (user?.role !== 'owner') return <div className="alert alert-error">Access Denied</div>

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold dark:text-white">User Management</h2>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          onClick={() => setShowCreate(true)}
        >
          + Create User
        </button>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="p-4 text-sm font-medium text-gray-500 dark:text-gray-400">Username</th>
              <th className="p-4 text-sm font-medium text-gray-500 dark:text-gray-400">Role</th>
              <th className="p-4 text-sm font-medium text-gray-500 dark:text-gray-400">Branch</th>
              <th className="p-4 text-sm font-medium text-gray-500 dark:text-gray-400">Permissions</th>
              <th className="p-4 text-sm font-medium text-gray-500 dark:text-gray-400 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">No users found.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="p-4 text-sm font-medium">{u.username || u.display_name}</td>
                  <td className="p-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.role === 'owner' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                      u.role === 'manager' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                      u.role === 'accountant' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>{u.role}</span>
                  </td>
                  <td className="p-4 text-sm">{u.branch_id === '11111111-1111-1111-1111-111111111111' ? 'Main' : 'Parallel'}</td>
                  <td className="p-4 text-sm">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(u.permissions || []).slice(0, 3).map(p => (
                        <span key={p} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{p}</span>
                      ))}
                      {(u.permissions || []).length > 3 && (
                        <span className="text-xs text-gray-400">+{u.permissions.length - 3} more</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => startEdit(u)} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(u.id)} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition">
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md animate-scaleIn">
            <h3 className="font-bold text-lg mb-4">Create New User</h3>
            <div className="space-y-3">
              <input className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
              <input className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              <select className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={role} onChange={e => setRole(e.target.value)}>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="accountant">Accountant</option>
              </select>
              <select className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={branchId} onChange={e => setBranchId(e.target.value)}>
                <option value="11111111-1111-1111-1111-111111111111">Main</option>
                <option value="22222222-2222-2222-2222-222222222222">Parallel</option>
              </select>
              <div>
                <label className="text-sm font-medium mb-2 block">Permissions</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {ALL_PERMISSIONS.map(p => (
                    <button
                      key={p}
                      onClick={() => setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                      className={`text-xs px-2 py-1.5 rounded-lg transition ${
                        permissions.includes(p) ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >{p}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" onClick={handleCreate} disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
              <button className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md animate-scaleIn">
            <h3 className="font-bold text-lg mb-4">Edit User</h3>
            <div className="space-y-3">
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Username"
                value={editUser.username}
                onChange={e => setEditUser({ ...editUser, username: e.target.value })}
              />
              <input
                type="password"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="New Password (leave blank to keep)"
                value={editUser.password || ''}
                onChange={e => setEditUser({ ...editUser, password: e.target.value })}
              />
              <select className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="accountant">Accountant</option>
              </select>
              <select className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={editUser.branch_id} onChange={e => setEditUser({ ...editUser, branch_id: e.target.value })}>
                <option value="11111111-1111-1111-1111-111111111111">Main</option>
                <option value="22222222-2222-2222-2222-222222222222">Parallel</option>
              </select>
              <div>
                <label className="text-sm font-medium mb-2 block">Permissions</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {ALL_PERMISSIONS.map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        const newPerms = editUser.permissions.includes(p)
                          ? editUser.permissions.filter(x => x !== p)
                          : [...editUser.permissions, p]
                        setEditUser({ ...editUser, permissions: newPerms })
                      }}
                      className={`text-xs px-2 py-1.5 rounded-lg transition ${
                        editUser.permissions.includes(p) ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >{p}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" onClick={handleUpdate}>Update</button>
              <button className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition" onClick={() => setEditUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}