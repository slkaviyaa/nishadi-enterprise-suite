'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function ChartOfAccounts() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ account_name: '', account_type: 'asset', balance: 0 })

  useEffect(() => {
    supabase.from('chart_of_accounts')
      .select('*').eq('branch_id', branch).order('account_type')
      .then(({ data }) => setAccounts(data || []))
  }, [branch])

  const addAccount = async () => {
    if (!form.account_name) return showToast('Account name required', 'error')
    await supabase.from('chart_of_accounts').insert({ ...form, branch_id: branch })
    showToast('Account added')
    setForm({ account_name: '', account_type: 'asset', balance: 0 })
    supabase.from('chart_of_accounts')
      .select('*').eq('branch_id', branch).order('account_type')
      .then(({ data }) => setAccounts(data || []))
  }

  const deleteAccount = async (id) => {
    await supabase.from('chart_of_accounts').delete().eq('id', id)
    showToast('Deleted')
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Chart of Accounts</h2>
      <div className="card bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
        <div className="flex flex-wrap gap-2 mb-4">
          <input className="input input-bordered flex-1" placeholder="Account Name" value={form.account_name}
            onChange={e => setForm({...form, account_name: e.target.value})} />
          <select className="select select-bordered" value={form.account_type}
            onChange={e => setForm({...form, account_type: e.target.value})}>
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="equity">Equity</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <input type="number" className="input input-bordered w-32" placeholder="Balance" value={form.balance}
            onChange={e => setForm({...form, balance: Number(e.target.value)})} />
          <button className="btn btn-primary" onClick={addAccount}>Add</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead><tr><th>Name</th><th>Type</th><th>Balance</th><th></th></tr></thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id}>
                  <td>{a.account_name}</td>
                  <td className="capitalize">{a.account_type}</td>
                  <td className="font-semibold">Rs. {a.balance}</td>
                  <td><button className="btn btn-xs btn-outline text-error" onClick={() => deleteAccount(a.id)}>Del</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}