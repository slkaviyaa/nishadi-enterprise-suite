'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

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
    await supabase.from('cash_ledger').insert({ branch_id: branch, description, amount, type })
    setDesc(''); setAmount(0)
    supabase.from('cash_ledger').select('*').eq('branch_id', branch).order('created_at', { ascending: false }).then(({ data }) => setEntries(data || []))
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Cash Ledger</h2>
      <div className="card bg-white dark:bg-gray-800 p-4 shadow">
        <div className="flex gap-2 mb-2">
          <input className="input input-bordered flex-1" placeholder="Description" value={description} onChange={e => setDesc(e.target.value)} />
          <input type="number" className="input input-bordered w-32" placeholder="Amount" value={amount} onChange={e => setAmount(Number(e.target.value))} />
          <select className="select select-bordered" value={type} onChange={e => setType(e.target.value)}>
            <option value="cash_in">Cash In</option>
            <option value="cash_out">Cash Out</option>
          </select>
          <button className="btn btn-primary" onClick={addEntry}>Add</button>
        </div>
        <table className="table w-full">
          <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id}>
                <td>{new Date(e.created_at).toLocaleDateString()}</td><td>{e.description}</td><td>{e.type}</td><td>Rs. {e.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}