'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

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
    supabase.from('bank_ledger')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setEntries(data || []))
  }, [branch])

  const addEntry = async () => {
    if (!bankName || amount <= 0) return showToast('Bank name and amount required', 'error')
    await supabase.from('bank_ledger').insert({
      branch_id: branch, bank_name: bankName, account_number: accountNumber, description, amount, type
    })
    showToast('Entry added')
    setBankName(''); setAccountNumber(''); setDescription(''); setAmount(0)
    supabase.from('bank_ledger')
      .select('*').eq('branch_id', branch).order('created_at', { ascending: false })
      .then(({ data }) => setEntries(data || []))
  }

  const deleteEntry = async (id) => {
    await supabase.from('bank_ledger').delete().eq('id', id)
    showToast('Deleted')
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Bank Ledger</h2>
      <div className="card bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
        <div className="flex flex-wrap gap-2 mb-4">
          <input className="input input-bordered w-32" placeholder="Bank Name" value={bankName} onChange={e => setBankName(e.target.value)} />
          <input className="input input-bordered w-40" placeholder="Account No" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
          <input className="input input-bordered flex-1" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
          <input type="number" className="input input-bordered w-32" placeholder="Amount" value={amount} onChange={e => setAmount(Number(e.target.value))} />
          <select className="select select-bordered" value={type} onChange={e => setType(e.target.value)}>
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
          </select>
          <button className="btn btn-primary" onClick={addEntry}>Add</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead><tr><th>Date</th><th>Bank</th><th>Description</th><th>Type</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td className="text-sm">{new Date(e.created_at).toLocaleDateString()}</td>
                  <td>{e.bank_name}</td>
                  <td>{e.description}</td>
                  <td className={e.type === 'deposit' ? 'text-green-600' : 'text-red-600'}>{e.type}</td>
                  <td className="font-semibold">Rs. {e.amount}</td>
                  <td><button className="btn btn-xs btn-outline text-error" onClick={() => deleteEntry(e.id)}>Del</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}