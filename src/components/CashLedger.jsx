'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import PageTemplate from './PageTemplate';

export default function CashLedger() {
  const { branch } = useAuth()
  const [entries, setEntries] = useState([])
  const [description, setDesc] = useState('')
  const [amount, setAmount] = useState(0)
  const [type, setType] = useState('cash_in')

  useEffect(() => {
    supabase.from('cash_ledger').select('*').eq('branch_id', branch).order('created_at', { ascending: false }).then(({ data }) => setEntries(data || []))
  }, [branch])

  const addEntry = async () => {
    if (!description || amount <= 0) return alert('Enter description and amount')
    await supabase.from('cash_ledger').insert({ branch_id: branch, description, amount, type })
    setDesc(''); setAmount(0)
    supabase.from('cash_ledger').select('*').eq('branch_id', branch).order('created_at', { ascending: false }).then(({ data }) => setEntries(data || []))
  }

  const cashIn = entries.filter(e => e.type === 'cash_in').reduce((s, e) => s + Number(e.amount), 0)
  const cashOut = entries.filter(e => e.type === 'cash_out').reduce((s, e) => s + Number(e.amount), 0)

  const metrics = [
    { label: 'Net Cash Balance', value: `Rs. ${(cashIn - cashOut).toLocaleString()}`, icon: '💰' },
    { label: 'Total Cash In', value: `Rs. ${cashIn.toLocaleString()}`, icon: '📥' },
    { label: 'Total Cash Out', value: `Rs. ${cashOut.toLocaleString()}`, icon: '📤' },
  ]

  return (
    <PageTemplate
      title="📒 Cash Ledger"
      subtitle="Manage cash inflows and outflows"
      metrics={metrics}
    >
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-white">Record Cash Transaction</h3>
          <div className="flex flex-wrap gap-3">
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-1 min-w-[200px]" placeholder="Description" value={description} onChange={e => setDesc(e.target.value)} />
            <input type="number" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-32" placeholder="Amount" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} />
            <select className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={type} onChange={e => setType(e.target.value)}>
              <option value="cash_in">Cash In</option>
              <option value="cash_out">Cash Out</option>
            </select>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shadow-sm" onClick={addEntry}>+ Add</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                  <th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Type</th><th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700 text-sm">
                {entries.length === 0 ? <tr><td colSpan="4" className="p-6 text-center text-gray-400">No records found</td></tr> : entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="p-3 text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="p-3 font-medium">{e.description}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${e.type === 'cash_in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {e.type === 'cash_in' ? 'Cash In' : 'Cash Out'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-right text-gray-800 dark:text-white">Rs. {Number(e.amount).toLocaleString()}</td>
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