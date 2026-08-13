'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import PageTemplate from '../PageTemplate' // 👈 Fixed import

export default function ChequeManagement() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [cheques, setCheques] = useState([])
  const [form, setForm] = useState({
    cheque_number: '', bank_name: '', amount: 0,
    issue_date: '', due_date: '', payee: '', status: 'issued'
  })

  useEffect(() => {
    if (!branch) return
    supabase.from('cheque_management')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setCheques(data || []))
  }, [branch])

  const addCheque = async () => {
    if (!form.cheque_number || !form.bank_name || form.amount <= 0)
      return showToast('Fill required fields', 'error')
    await supabase.from('cheque_management').insert({ ...form, branch_id: branch })
    showToast('Cheque added', 'success')
    setForm({ cheque_number: '', bank_name: '', amount: 0, issue_date: '', due_date: '', payee: '', status: 'issued' })
    supabase.from('cheque_management')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setCheques(data || []))
  }

  const updateStatus = async (id, status) => {
    await supabase.from('cheque_management').update({ status }).eq('id', id)
    showToast('Status updated', 'success')
    setCheques(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  const deleteCheque = async (id) => {
    await supabase.from('cheque_management').delete().eq('id', id)
    showToast('Deleted', 'info')
    setCheques(prev => prev.filter(c => c.id !== id))
  }

  const metrics = [
    { label: 'Total Cheques', value: cheques.length, icon: '🎫' },
    { label: 'Cleared', value: cheques.filter(c => c.status === 'cleared').length, icon: '✅' },
    { label: 'Bounced', value: cheques.filter(c => c.status === 'bounced').length, icon: '❌' },
  ]

  return (
    <PageTemplate
      title="🎫 Cheque Management"
      subtitle="Track issued, cleared, and bounced cheques"
      metrics={metrics}
    >
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-white">Add New Cheque</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Cheque No *" value={form.cheque_number} onChange={e => setForm({...form, cheque_number: e.target.value})} />
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Bank *" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} />
            <input type="number" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Amount *" value={form.amount || ''} onChange={e => setForm({...form, amount: Number(e.target.value)})} />
            <input type="date" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={form.issue_date} onChange={e => setForm({...form, issue_date: e.target.value})} />
            <input type="date" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Payee" value={form.payee} onChange={e => setForm({...form, payee: e.target.value})} />
          </div>
          <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shadow-sm" onClick={addCheque}>+ Add Cheque</button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                  <th className="p-3">Cheque No</th><th className="p-3">Bank</th><th className="p-3">Amount</th><th className="p-3">Issue</th><th className="p-3">Due</th><th className="p-3">Payee</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700 text-sm">
                {cheques.length === 0 ? <tr><td colSpan="8" className="p-6 text-center text-gray-400">No cheques found</td></tr> : cheques.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="p-3">{c.cheque_number}</td><td className="p-3">{c.bank_name}</td>
                    <td className="p-3 font-bold">Rs. {Number(c.amount).toLocaleString()}</td>
                    <td className="p-3 text-gray-500">{c.issue_date}</td><td className="p-3 text-gray-500">{c.due_date}</td><td className="p-3">{c.payee}</td>
                    <td className="p-3">
                      <select className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700" value={c.status} onChange={e => updateStatus(c.id, e.target.value)}>
                        <option value="issued">Issued</option><option value="cleared">Cleared</option><option value="bounced">Bounced</option><option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="p-3 text-right"><button className="text-red-600 hover:text-red-800 text-xs font-medium" onClick={() => deleteCheque(c.id)}>Delete</button></td>
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