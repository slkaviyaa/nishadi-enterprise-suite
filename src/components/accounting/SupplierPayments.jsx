'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import PageTemplate from '../PageTemplate' // 👈 Fixed import

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
    if (!branch) return
    supabase.from('suppliers').select('*').eq('branch_id', branch).then(({ data }) => setSuppliers(data || []))
    supabase.from('supplier_payments').select('*, suppliers(name)').eq('branch_id', branch)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPayments(data || []))
  }, [branch])

  const addPayment = async () => {
    if (!selectedSupplier || amount <= 0) return showToast('Select supplier and enter amount', 'error')
    await supabase.from('supplier_payments').insert({ branch_id: branch, supplier_id: selectedSupplier, amount, payment_mode: paymentMode, reference })
    showToast('Payment recorded', 'success')
    setSelectedSupplier(''); setAmount(0); setPaymentMode('cash'); setReference('')
    supabase.from('supplier_payments').select('*, suppliers(name)').eq('branch_id', branch)
      .order('created_at', { ascending: false }).then(({ data }) => setPayments(data || []))
  }

  const deletePayment = async (id) => {
    await supabase.from('supplier_payments').delete().eq('id', id)
    showToast('Deleted', 'info')
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)

  const metrics = [
    { label: 'Total Payments', value: payments.length, icon: '📝' },
    { label: 'Total Amount Paid', value: `Rs. ${totalPaid.toLocaleString()}`, icon: '💸' },
  ]

  return (
    <PageTemplate
      title="💸 Supplier Payments"
      subtitle="Settle outstanding purchase orders and record payouts"
      metrics={metrics}
    >
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-white">Record Payment</h3>
          <div className="flex flex-wrap gap-3">
            <select className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-1 min-w-[200px]" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
              <option value="">Select Supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="number" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-32" placeholder="Amount" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} />
            <select className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
              <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option>
            </select>
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-40" placeholder="Reference #" value={reference} onChange={e => setReference(e.target.value)} />
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shadow-sm" onClick={addPayment}>+ Record</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                  <th className="p-3">Date</th><th className="p-3">Supplier</th><th className="p-3">Amount</th><th className="p-3">Mode</th><th className="p-3">Reference</th><th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700 text-sm">
                {payments.length === 0 ? <tr><td colSpan="6" className="p-6 text-center text-gray-400">No payments found</td></tr> : payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="p-3 text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="p-3 font-medium">{p.suppliers?.name || 'Unknown Supplier'}</td>
                    <td className="p-3 font-bold text-gray-800 dark:text-white">Rs. {Number(p.amount).toLocaleString()}</td>
                    <td className="p-3 capitalize">{p.payment_mode.replace('_', ' ')}</td>
                    <td className="p-3 text-gray-500">{p.reference || '-'}</td>
                    <td className="p-3 text-right"><button className="text-red-600 hover:text-red-800 text-xs font-medium" onClick={() => deletePayment(p.id)}>Delete</button></td>
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