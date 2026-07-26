'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function SupplierPayments() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [suppliers, setSuppliers] = useState([])
  const [payments, setPayments] = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [amount, setAmount] = useState(0)
  const [paymentMode, setPaymentMode] = useState('cash')
  const [reference, setReference] = useState('')

  useEffect(() => {
    supabase.from('suppliers').select('*').eq('branch_id', branch).then(({ data }) => setSuppliers(data || []))
    supabase.from('supplier_payments').select('*, suppliers(name)').eq('branch_id', branch)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPayments(data || []))
  }, [branch])

  const addPayment = async () => {
    if (!selectedSupplier || amount <= 0) return showToast('Select supplier and enter amount', 'error')
    await supabase.from('supplier_payments').insert({
      branch_id: branch, supplier_id: selectedSupplier, amount, payment_mode: paymentMode, reference
    })
    showToast('Payment recorded')
    setSelectedSupplier(''); setAmount(0); setPaymentMode('cash'); setReference('')
    supabase.from('supplier_payments').select('*, suppliers(name)').eq('branch_id', branch)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPayments(data || []))
  }

  const deletePayment = async (id) => {
    await supabase.from('supplier_payments').delete().eq('id', id)
    showToast('Deleted')
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Supplier Payments</h2>
      <div className="card bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
        <div className="flex flex-wrap gap-2 mb-4">
          <select className="select select-bordered flex-1" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
            <option value="">Select Supplier</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="number" className="input input-bordered w-32" placeholder="Amount" value={amount} onChange={e => setAmount(Number(e.target.value))} />
          <select className="select select-bordered" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
          </select>
          <input className="input input-bordered w-32" placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)} />
          <button className="btn btn-primary" onClick={addPayment}>Add</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead><tr><th>Date</th><th>Supplier</th><th>Amount</th><th>Mode</th><th>Reference</th><th></th></tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="text-sm">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>{p.suppliers?.name}</td>
                  <td className="font-semibold">Rs. {p.amount}</td>
                  <td className="capitalize">{p.payment_mode}</td>
                  <td>{p.reference}</td>
                  <td><button className="btn btn-xs btn-outline text-error" onClick={() => deletePayment(p.id)}>Del</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}