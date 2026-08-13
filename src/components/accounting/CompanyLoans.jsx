'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import PageTemplate from '../PageTemplate' // 👈 Fixed import

export default function CompanyLoans() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [loans, setLoans] = useState([])
  const [form, setForm] = useState({
    lender: '', amount: 0, interest_rate: 0,
    start_date: '', end_date: '', status: 'active'
  })

  useEffect(() => {
    if (!branch) return
    supabase.from('company_loans')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setLoans(data || []))
  }, [branch])

  const addLoan = async () => {
    if (!form.lender || form.amount <= 0) return showToast('Lender and amount required', 'error')
    await supabase.from('company_loans').insert({ ...form, branch_id: branch })
    showToast('Loan added', 'success')
    setForm({ lender: '', amount: 0, interest_rate: 0, start_date: '', end_date: '', status: 'active' })
    supabase.from('company_loans')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setLoans(data || []))
  }

  const updateStatus = async (id, status) => {
    await supabase.from('company_loans').update({ status }).eq('id', id)
    showToast('Status updated', 'success')
    setLoans(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  const deleteLoan = async (id) => {
    await supabase.from('company_loans').delete().eq('id', id)
    showToast('Deleted', 'info')
    setLoans(prev => prev.filter(l => l.id !== id))
  }

  const totalAmount = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
  
  const metrics = [
    { label: 'Total Loans', value: loans.length, icon: '📋' },
    { label: 'Active Loans', value: loans.filter(l => l.status === 'active').length, icon: '🏢' },
    { label: 'Total Active Amount', value: `Rs. ${totalAmount.toLocaleString()}`, icon: '💰' },
  ]

  return (
    <PageTemplate
      title="🏢 Company Loans"
      subtitle="Manage internal and external business loans"
      metrics={metrics}
    >
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-white">Add New Loan</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Lender *" value={form.lender} onChange={e => setForm({...form, lender: e.target.value})} />
            <input type="number" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Amount *" value={form.amount || ''} onChange={e => setForm({...form, amount: Number(e.target.value)})} />
            <input type="number" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Interest %" value={form.interest_rate || ''} onChange={e => setForm({...form, interest_rate: Number(e.target.value)})} />
            <input type="date" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            <input type="date" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
          </div>
          <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shadow-sm" onClick={addLoan}>+ Add Loan</button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                  <th className="p-3">Lender</th><th className="p-3">Amount</th><th className="p-3">Interest</th><th className="p-3">Period</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700 text-sm">
                {loans.length === 0 ? <tr><td colSpan="6" className="p-6 text-center text-gray-400">No loans found</td></tr> : loans.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="p-3 font-medium">{l.lender}</td><td className="p-3 font-bold">Rs. {Number(l.amount).toLocaleString()}</td>
                    <td className="p-3">{l.interest_rate}%</td><td className="p-3 text-gray-500">{l.start_date} → {l.end_date}</td>
                    <td className="p-3">
                      <select className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700" value={l.status} onChange={e => updateStatus(l.id, e.target.value)}>
                        <option value="active">Active</option><option value="paid">Paid</option><option value="defaulted">Defaulted</option>
                      </select>
                    </td>
                    <td className="p-3 text-right"><button className="text-red-600 hover:text-red-800 text-xs font-medium" onClick={() => deleteLoan(l.id)}>Delete</button></td>
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