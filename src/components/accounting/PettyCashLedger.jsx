'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import PageTemplate from '../PageTemplate' // 👈 Fixed import

export default function PettyCashLedger() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [entries, setEntries] = useState([])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [type, setType] = useState('cash_in')

  useEffect(() => {
    if (!branch) return
    supabase.from('petty_cash_ledger')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setEntries(data || []))
  }, [branch])

  const addEntry = async () => {
    if (!description || amount <= 0) return showToast('Enter description and amount', 'error')
    await supabase.from('petty_cash_ledger').insert({ branch_id: branch, description, amount, type })
    showToast('Entry added', 'success')
    setDescription(''); setAmount(0)
    supabase.from('petty_cash_ledger')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setEntries(data || []))
  }

  const deleteEntry = async (id) => {
    await supabase.from('petty_cash_ledger').delete().eq('id', id)
    showToast('Deleted', 'info')
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const cashIn = entries.filter(e => e.type === 'cash_in').reduce((s, e) => s + Number(e.amount), 0)
  const cashOut = entries.filter(e => e.type === 'cash_out').reduce((s, e) => s + Number(e.amount), 0)
  
  const metrics = [
    { label: 'Current Balance', value: `Rs. ${(cashIn - cashOut).toLocaleString()}`, icon: '💵' },
    { label: 'Total Cash In', value: `Rs. ${cashIn.toLocaleString()}`, icon: '📥' },
    { label: 'Total Cash Out', value: `Rs. ${cashOut.toLocaleString()}`, icon: '📤' },
  ]

  return (
    <PageTemplate
      title="💵 Petty Cash Ledger"
      subtitle="Manage daily small cash expenses and float"
      metrics={metrics}
    >
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-white">Record Cash Flow</h3>
          <div className="flex flex-wrap gap-3">
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-1 min-w-[200px]" placeholder="Description (e.g. Tea for staff)" value={description} onChange={e => setDescription(e.target.value)} />
            <input type="number" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-32" placeholder="Amount" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} />
            <select className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={type} onChange={e => setType(e.target.value)}>
              <option value="cash_in">Cash In</option>
              <option value="cash_out">Cash Out</option>
            </select>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shadow-sm" onClick={addEntry}>+ Record</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                  <th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Type</th><th className="p-3">Amount</th><th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700 text-sm">
                {entries.length === 0 ? <tr><td colSpan="5" className="p-6 text-center text-gray-400">No records found</td></tr> : entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="p-3 text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="p-3 font-medium">{e.description}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${e.type === 'cash_in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {e.type === 'cash_in' ? 'IN' : 'OUT'}
                      </span>
                    </td>
                    <td className="p-3 font-bold">Rs. {Number(e.amount).toLocaleString()}</td>
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