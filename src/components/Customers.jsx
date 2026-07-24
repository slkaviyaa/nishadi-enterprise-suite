'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Link from 'next/link'

export default function Customers() {
  const { branch } = useAuth()
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    supabase.from('customers').select('*').eq('branch_id', branch).order('name').then(({ data }) => setCustomers(data || []))
  }, [branch])

  const addPayment = async (custId, amt) => {
    await supabase.from('credit_transactions').insert({
      customer_id: custId,
      branch_id: branch,
      amount: amt,
      type: 'payment',
      payment_mode: 'cash'   // ← FIX
    })
    await supabase.rpc('update_customer_credit', { cust_id: custId, payment: amt })
    window.location.reload()
  }

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <h2 className="text-2xl font-bold dark:text-white">Customer Management</h2>
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="p-3 text-sm font-medium dark:text-gray-300">Name</th>
              <th className="p-3 text-sm font-medium dark:text-gray-300">Phone</th>
              <th className="p-3 text-sm font-medium dark:text-gray-300">Credit</th>
              <th className="p-3 text-sm font-medium dark:text-gray-300">Loyalty</th>
              <th className="p-3 text-sm font-medium dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center opacity-50">No customers found.</td></tr>
            ) : (
              customers.map(c => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">{c.phone}</td>
                  <td className={`p-3 font-semibold ${c.total_credit > 0 ? 'text-red-500' : ''}`}>Rs. {c.total_credit.toLocaleString()}</td>
                  <td className="p-3">{c.loyalty_points} pts</td>
                  <td className="p-3 flex gap-2">
                    <button className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition" onClick={() => { const amt = prompt('Payment amount:'); if (amt) addPayment(c.id, Number(amt)) }}>Add Payment</button>
                    <Link href={`/customer/${c.id}`} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">📋 Profile</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}