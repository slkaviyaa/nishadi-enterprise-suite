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
  const { user } = useAuth()
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

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    const { data, error } = await supabase.from('staff').select('*')
    if (error) showToast('Unable to load users', 'error')
    setUsers(data || [])
  }

  const handleCreate = async () => {
    if (!username || !password) { showToast('Username and password required', 'error'); return }
    setLoading(true)
    const res = await fetch('/api/create-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, branch_id: branchId, role, permissions, display_name: username })
    })
    const result = await res.json()
    if (result.error) showToast(result.error, 'error')
    else { showToast('User created!'); setUsername(''); setPassword(''); setPermissions([]); setShowCreate(false); loadUsers() }
    setLoading(false)
  }

  const startEdit = (u) => setEditUser({ id: u.id, username: u.username || '', role: u.role, branch_id: u.branch_id, permissions: u.permissions || [] })

  const handleUpdate = async () => {
    const res = await fetch('/api/update-user', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editUser.id, username: editUser.username, password: editUser.password || undefined, role: editUser.role, branch_id: editUser.branch_id, permissions: editUser.permissions })
    })
    const result = await res.json()
    if (result.error) showToast(result.error, 'error')
    else { showToast('User updated!'); setEditUser(null); loadUsers() }
  }

  const handleDelete = async (userId) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    const res = await fetch('/api/delete-user', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
    const result = await res.json()
    if (result.error) showToast(result.error, 'error')
    else { showToast('User deleted!'); loadUsers() }
  }

  if (user?.role !== 'owner') return <div className="alert alert-error">Access Denied</div>

  return (
    <div className="space-y-6 text-gray-900 dark:text-white">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" onClick={() => setShowCreate(true)}>+ Create User</button>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow">
        <table className="w-full">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700 text-left">
            <th className="p-4 text-sm font-medium text-gray-500">Username</th><th className="p-4 text-sm font-medium text-gray-500">Role</th><th className="p-4 text-sm font-medium text-gray-500">Branch</th><th className="p-4 text-sm font-medium text-gray-500">Permissions</th><th className="p-4 text-sm font-medium text-gray-500 text-center">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">No users found.</td></tr> : users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="p-4 text-sm font-medium">{u.username || u.display_name}</td>
                <td className="p-4 text-sm">{u.role}</td>
                <td className="p-4 text-sm">{getBranchLabel(u.branch_id)}</td>
                <td className="p-4 text-sm"><div className="flex flex-wrap gap-1 max-w-[200px]">{(u.permissions || []).slice(0, 3).map(p => <span key={p} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{p}</span>)}{(u.permissions || []).length > 3 && <span className="text-xs text-gray-400">+{u.permissions.length - 3} more</span>}</div></td>
                <td className="p-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => startEdit(u)} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg">✏️ Edit</button><button onClick={() => handleDelete(u.id)} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg">🗑️ Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md"><h3 className="font-bold text-lg mb-4">Create New User</h3><div className="space-y-3">
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="w-full border rounded-lg px-3 py-2" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <select className="w-full border rounded-lg px-3 py-2" value={role} onChange={e => setRole(e.target.value)}><option value="owner">Owner</option><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="accountant">Accountant</option></select>
        <select className="w-full border rounded-lg px-3 py-2" value={branchId} onChange={e => setBranchId(e.target.value)}><option value={BRANCHES.MAIN}>Main</option><option value={BRANCHES.PARALLEL}>Parallel</option></select>
        <div><label className="text-sm font-medium mb-2 block">Permissions</label><div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">{ALL_PERMISSIONS.map(p => <button key={p} onClick={() => setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} className={`text-xs px-2 py-1.5 rounded-lg ${permissions.includes(p) ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>{p}</button>)}</div></div>
      </div><div className="flex gap-2 mt-4"><button className="flex-1 py-2 bg-blue-600 text-white rounded-xl" onClick={handleCreate} disabled={loading}>{loading ? 'Creating...' : 'Create'}</button><button className="flex-1 py-2 bg-gray-200 rounded-xl" onClick={() => setShowCreate(false)}>Cancel</button></div></div></div>}

      {editUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md"><h3 className="font-bold text-lg mb-4">Edit User</h3><div className="space-y-3">
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Username" value={editUser.username} onChange={e => setEditUser({ ...editUser, username: e.target.value })} />
        <input type="password" className="w-full border rounded-lg px-3 py-2" placeholder="New Password (leave blank to keep)" value={editUser.password || ''} onChange={e => setEditUser({ ...editUser, password: e.target.value })} />
        <select className="w-full border rounded-lg px-3 py-2" value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}><option value="owner">Owner</option><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="accountant">Accountant</option></select>
        <select className="w-full border rounded-lg px-3 py-2" value={editUser.branch_id} onChange={e => setEditUser({ ...editUser, branch_id: e.target.value })}><option value={BRANCHES.MAIN}>Main</option><option value={BRANCHES.PARALLEL}>Parallel</option></select>
        <div><label className="text-sm font-medium mb-2 block">Permissions</label><div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">{ALL_PERMISSIONS.map(p => <button key={p} onClick={() => setEditUser({ ...editUser, permissions: editUser.permissions.includes(p) ? editUser.permissions.filter(x => x !== p) : [...editUser.permissions, p] })} className={`text-xs px-2 py-1.5 rounded-lg ${editUser.permissions.includes(p) ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>{p}</button>)}</div></div>
      </div><div className="flex gap-2 mt-4"><button className="flex-1 py-2 bg-blue-600 text-white rounded-xl" onClick={handleUpdate}>Update</button><button className="flex-1 py-2 bg-gray-200 rounded-xl" onClick={() => setEditUser(null)}>Cancel</button></div></div></div>}
    </div>
  )
}
