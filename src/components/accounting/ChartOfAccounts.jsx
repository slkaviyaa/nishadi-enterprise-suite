'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import PageTemplate from '../PageTemplate' // 👈 Path eka hari

export default function ChartOfAccounts() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ account_name: '', account_type: 'asset', balance: 0 })

  useEffect(() => {
    if (!branch) return
    supabase.from('chart_of_accounts')
      .select('*').eq('branch_id', branch).order('account_type')
      .then(({ data }) => setAccounts(data || []))
  }, [branch])

  const addAccount = async () => {
    if (!form.account_name) return showToast('Account name required', 'error')
    await supabase.from('chart_of_accounts').insert({ ...form, branch_id: branch })
    showToast('Account added', 'success')
    setForm({ account_name: '', account_type: 'asset', balance: 0 })
    supabase.from('chart_of_accounts')
      .select('*').eq('branch_id', branch).order('account_type')
      .then(({ data }) => setAccounts(data || []))
  }

  const deleteAccount = async (id) => {
    await supabase.from('chart_of_accounts').delete().eq('id', id)
    showToast('Deleted', 'info')
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  const totalAssets = accounts.filter(a => a.account_type === 'asset').reduce((sum, a) => sum + (Number(a.balance) || 0), 0)
  const totalLiabilities = accounts.filter(a => a.account_type === 'liability').reduce((sum, a) => sum + (Number(a.balance) || 0), 0)
  const totalEquity = accounts.filter(a => a.account_type === 'equity').reduce((sum, a) => sum + (Number(a.balance) || 0), 0)

  const metrics = [
    { label: 'Total Assets', value: `Rs. ${totalAssets.toLocaleString()}`, icon: '🏛️' },
    { label: 'Total Liabilities', value: `Rs. ${totalLiabilities.toLocaleString()}`, icon: '📉' },
    { label: 'Total Equity', value: `Rs. ${totalEquity.toLocaleString()}`, icon: '⚖️' },
  ]

  return (
    <PageTemplate
      title="📋 Chart of Accounts (ගිණුම් ලේඛනය)"
      subtitle="Manage double-entry ledger categories"
      metrics={metrics}
    >
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-white">Add New Account</h3>
          <div className="flex flex-wrap gap-3">
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none flex-1 min-w-[200px]" placeholder="Account Name *" value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} />
            <select className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none w-full sm:w-40" value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}>
              <option value="asset">Asset (වත්කම්)</option>
              <option value="liability">Liability (වගකීම්)</option>
              <option value="equity">Equity (හිමිකම්)</option>
              <option value="income">Income (ආදායම්)</option>
              <option value="expense">Expense (වියදම්)</option>
            </select>
            <input type="number" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none w-full sm:w-36" placeholder="Initial Balance" value={form.balance || ''} onChange={e => setForm({ ...form, balance: Number(e.target.value) })} />
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shadow-sm" onClick={addAccount}>+ Add Account</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                  <th className="p-3">Account Name</th><th className="p-3">Category / Type</th><th className="p-3">Balance</th><th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700 text-sm">
                {accounts.length === 0 ? <tr><td colSpan="4" className="p-6 text-center text-gray-400">No ledger accounts found</td></tr> : accounts.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="p-3 font-medium text-gray-800 dark:text-white">{a.account_name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs capitalize font-semibold ${
                        a.account_type === 'asset' ? 'bg-blue-100 text-blue-700' :
                        a.account_type === 'liability' ? 'bg-red-100 text-red-700' :
                        a.account_type === 'income' ? 'bg-green-100 text-green-700' :
                        a.account_type === 'expense' ? 'bg-orange-100 text-orange-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {a.account_type}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-gray-800 dark:text-white">Rs. {Number(a.balance || 0).toLocaleString()}</td>
                    <td className="p-3 text-right"><button className="text-red-600 hover:text-red-800 text-xs font-medium" onClick={() => deleteAccount(a.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageTemplate>
  )
}