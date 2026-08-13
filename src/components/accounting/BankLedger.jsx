'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import PageTemplate from '../PageTemplate' // 👈 Path eka hari

export default function BankLedger() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [entries, setEntries] = useState([])
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [type, setType] = useState('deposit')

  useEffect(() => {
    if (!branch) return
    supabase.from('bank_ledger')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setEntries(data || []))
  }, [branch])

  const addEntry = async () => {
    if (!bankName || amount <= 0) return showToast('Bank name and amount required', 'error')
    await supabase.from('bank_ledger').insert({
      branch_id: branch, bank_name: bankName, account_number: accountNumber, description, amount, type
    })
    showToast('Entry added', 'success')
    setBankName(''); setAccountNumber(''); setDescription(''); setAmount(0)
    supabase.from('bank_ledger')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setEntries(data || []))
  }

  const deleteEntry = async (id) => {
    await supabase.from('bank_ledger').delete().eq('id', id)
    showToast('Deleted', 'info')
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const totalDeposits = entries.filter(e => e.type === 'deposit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const totalWithdrawals = entries.filter(e => e.type === 'withdrawal').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const netBalance = totalDeposits - totalWithdrawals

  const metrics = [
    { label: 'Net Bank Balance', value: `Rs. ${netBalance.toLocaleString()}`, icon: '🏦' },
    { label: 'Total Deposits', value: `Rs. ${totalDeposits.toLocaleString()}`, icon: '📈' },
    { label: 'Total Withdrawals', value: `Rs. ${totalWithdrawals.toLocaleString()}`, icon: '📉' },
  ]

  return (
    <PageTemplate
      title="🏦 Bank Ledger Management"
      subtitle="Track deposits, withdrawals, and bank accounts"
      metrics={metrics}
    >
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-white">Add New Bank Entry</h3>
          <div className="flex flex-wrap gap-3">
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none w-full sm:w-40" placeholder="Bank Name *" value={bankName} onChange={e => setBankName(e.target.value)} />
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none w-full sm:w-40" placeholder="Account No" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none flex-1 min-w-[180px]" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
            <input type="number" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none w-full sm:w-32" placeholder="Amount *" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} />
            <select className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none" value={type} onChange={e => setType(e.target.value)}>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shadow-sm" onClick={addEntry}>+ Add Entry</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                  <th className="p-3">Date</th><th className="p-3">Bank Name</th><th className="p-3">Account No</th><th className="p-3">Description</th><th className="p-3">Type</th><th className="p-3">Amount</th><th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700 text-sm">
                {entries.length === 0 ? <tr><td colSpan="7" className="p-6 text-center text-gray-400">No bank ledger entries found</td></tr> : entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="p-3 text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="p-3 font-medium text-gray-800 dark:text-white">{e.bank_name}</td>
                    <td className="p-3 text-gray-500">{e.account_number || '—'}</td>
                    <td className="p-3 text-gray-500">{e.description || '—'}</td>
                    <td className="p-3 font-semibold">
                      <span className={`px-2 py-0.5 rounded text-xs ${e.type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-gray-800 dark:text-white">Rs. {Number(e.amount).toLocaleString()}</td>
                    <td className="p-3 text-right"><button className="text-red-600 hover:text-red-800 text-xs font-medium" onClick={() => deleteEntry(e.id)}>Delete</button></td>
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