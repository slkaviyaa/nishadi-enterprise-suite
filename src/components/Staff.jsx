'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Staff() {
  const { branch, user } = useAuth()
  const [staff, setStaff] = useState([])
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseList, setExpenseList] = useState([])

  useEffect(() => {
    supabase.from('staff').select('*').eq('branch_id', branch).then(({ data }) => setStaff(data || []))
    supabase.from('expenses').select('*').eq('branch_id', branch).order('created_at',{ascending:false}).then(({ data }) => setExpenseList(data || []))
  }, [branch])

  const addExpense = async () => {
    await supabase.from('expenses').insert({ branch_id: branch, description: desc, amount: Number(amount), category: 'general' })
    setDesc(''); setAmount('')
    supabase.from('expenses').select('*').eq('branch_id', branch).order('created_at',{ascending:false}).then(({ data }) => setExpenseList(data || []))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Staff & Expenses</h2>
      <div className="card bg-base-100 p-4">
        <h3 className="font-semibold">Staff Members</h3>
        <ul className="list-disc ml-4">{staff.map(s => <li key={s.id}>{s.display_name} ({s.role})</li>)}</ul>
      </div>
      {user?.role === 'owner' && (
        <div className="card bg-base-100 p-4">
          <h3 className="font-semibold">Add Expense</h3>
          <div className="flex gap-2 mt-2">
            <input className="input input-bordered flex-1" placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)} />
            <input className="input input-bordered w-32" type="number" placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)} />
            <button className="btn btn-primary" onClick={addExpense}>Add</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="table"><thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
        <tbody>{expenseList.map(e=><tr key={e.id}><td>{new Date(e.created_at).toLocaleDateString()}</td><td>{e.description}</td><td>Rs. {e.amount}</td></tr>)}</tbody></table>
      </div>
    </div>
  )
}