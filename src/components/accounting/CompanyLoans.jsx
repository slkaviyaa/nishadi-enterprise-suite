'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function CompanyLoans() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [loans, setLoans] = useState([])
  const [form, setForm] = useState({
    lender: '', amount: 0, interest_rate: 0,
    start_date: '', end_date: '', status: 'active'
  })

  useEffect(() => {
    supabase.from('company_loans')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setLoans(data || []))
  }, [branch])

  const addLoan = async () => {
    if (!form.lender || form.amount <= 0) return showToast('Lender and amount required', 'error')
    await supabase.from('company_loans').insert({ ...form, branch_id: branch })
    showToast('Loan added')
    setForm({ lender: '', amount: 0, interest_rate: 0, start_date: '', end_date: '', status: 'active' })
    supabase.from('company_loans')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setLoans(data || []))
  }

  const updateStatus = async (id, status) => {
    await supabase.from('company_loans').update({ status }).eq('id', id)
    showToast('Status updated')
    setLoans(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  const deleteLoan = async (id) => {
    await supabase.from('company_loans').delete().eq('id', id)
    showToast('Deleted')
    setLoans(prev => prev.filter(l => l.id !== id))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Company Loans</h2>
      <div className="card bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <input className="input input-bordered" placeholder="Lender" value={form.lender}
            onChange={e => setForm({...form, lender: e.target.value})} />
          <input type="number" className="input input-bordered" placeholder="Amount" value={form.amount}
            onChange={e => setForm({...form, amount: Number(e.target.value)})} />
          <input type="number" className="input input-bordered" placeholder="Interest %" value={form.interest_rate}
            onChange={e => setForm({...form, interest_rate: Number(e.target.value)})} />
          <input type="date" className="input input-bordered" value={form.start_date}
            onChange={e => setForm({...form, start_date: e.target.value})} />
          <input type="date" className="input input-bordered" value={form.end_date}
            onChange={e => setForm({...form, end_date: e.target.value})} />
        </div>
        <button className="btn btn-primary" onClick={addLoan}>Add Loan</button>

        <div className="overflow-x-auto mt-4">
          <table className="table w-full">
            <thead><tr><th>Lender</th><th>Amount</th><th>Interest</th><th>Period</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loans.map(l => (
                <tr key={l.id}>
                  <td>{l.lender}</td><td className="font-semibold">Rs. {l.amount}</td>
                  <td>{l.interest_rate}%</td>
                  <td>{l.start_date} → {l.end_date}</td>
                  <td>
                    <select className="select select-bordered select-xs" value={l.status}
                      onChange={e => updateStatus(l.id, e.target.value)}>
                      <option value="active">Active</option>
                      <option value="paid">Paid</option>
                      <option value="defaulted">Defaulted</option>
                    </select>
                  </td>
                  <td><button className="btn btn-xs btn-outline text-error" onClick={() => deleteLoan(l.id)}>Del</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}