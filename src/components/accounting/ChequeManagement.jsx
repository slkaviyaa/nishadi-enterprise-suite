'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function ChequeManagement() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [cheques, setCheques] = useState([])
  const [form, setForm] = useState({
    cheque_number: '', bank_name: '', amount: 0,
    issue_date: '', due_date: '', payee: '', status: 'issued'
  })

  useEffect(() => {
    supabase.from('cheque_management')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setCheques(data || []))
  }, [branch])

  const addCheque = async () => {
    if (!form.cheque_number || !form.bank_name || form.amount <= 0)
      return showToast('Fill required fields', 'error')
    await supabase.from('cheque_management').insert({ ...form, branch_id: branch })
    showToast('Cheque added')
    setForm({ cheque_number: '', bank_name: '', amount: 0, issue_date: '', due_date: '', payee: '', status: 'issued' })
    supabase.from('cheque_management')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setCheques(data || []))
  }

  const updateStatus = async (id, status) => {
    await supabase.from('cheque_management').update({ status }).eq('id', id)
    showToast('Status updated')
    setCheques(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  const deleteCheque = async (id) => {
    await supabase.from('cheque_management').delete().eq('id', id)
    showToast('Deleted')
    setCheques(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Cheque Management</h2>
      <div className="card bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <input className="input input-bordered" placeholder="Cheque No" value={form.cheque_number}
            onChange={e => setForm({...form, cheque_number: e.target.value})} />
          <input className="input input-bordered" placeholder="Bank" value={form.bank_name}
            onChange={e => setForm({...form, bank_name: e.target.value})} />
          <input type="number" className="input input-bordered" placeholder="Amount" value={form.amount}
            onChange={e => setForm({...form, amount: Number(e.target.value)})} />
          <input type="date" className="input input-bordered" value={form.issue_date}
            onChange={e => setForm({...form, issue_date: e.target.value})} />
          <input type="date" className="input input-bordered" value={form.due_date}
            onChange={e => setForm({...form, due_date: e.target.value})} />
          <input className="input input-bordered" placeholder="Payee" value={form.payee}
            onChange={e => setForm({...form, payee: e.target.value})} />
        </div>
        <button className="btn btn-primary" onClick={addCheque}>Add Cheque</button>

        <div className="overflow-x-auto mt-4">
          <table className="table w-full">
            <thead><tr><th>Cheque No</th><th>Bank</th><th>Amount</th><th>Issue</th><th>Due</th><th>Payee</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {cheques.map(c => (
                <tr key={c.id}>
                  <td>{c.cheque_number}</td><td>{c.bank_name}</td>
                  <td className="font-semibold">Rs. {c.amount}</td>
                  <td>{c.issue_date}</td><td>{c.due_date}</td><td>{c.payee}</td>
                  <td>
                    <select className="select select-bordered select-xs" value={c.status}
                      onChange={e => updateStatus(c.id, e.target.value)}>
                      <option value="issued">Issued</option>
                      <option value="cleared">Cleared</option>
                      <option value="bounced">Bounced</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td><button className="btn btn-xs btn-outline text-error" onClick={() => deleteCheque(c.id)}>Del</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}