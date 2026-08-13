'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Link from 'next/link'
import PageTemplate from './PageTemplate';

export default function Customers() {
  const { branch } = useAuth()
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    supabase.from('customers').select('*').eq('branch_id', branch).order('name').then(({ data }) => setCustomers(data || []))
  }, [branch])

  const exportvCard = () => {
    let vcf = ''
    customers.forEach(c => {
      vcf += `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nTEL:${c.phone}\nEND:VCARD\n`
    })
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nishadi_customers.vcf'
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalCredit = customers.reduce((sum, c) => sum + (Number(c.total_credit) || 0), 0)

  const metrics = [
    { label: 'Total Customers', value: customers.length, icon: '👥' },
    { label: 'Outstanding Credit', value: `Rs. ${totalCredit.toLocaleString()}`, icon: '💳' },
  ]

  const actions = (
    <button onClick={exportvCard} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm shadow-sm font-medium">
      📇 Export as Contacts
    </button>
  )

  return (
    <PageTemplate
      title="👥 Customer Management"
      subtitle="View customer profiles and manage outstanding credits"
      metrics={metrics}
      actions={actions}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                <th className="p-4">Customer Name</th>
                <th className="p-4">Phone Number</th>
                <th className="p-4 text-right">Outstanding Credit</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700 text-sm">
              {customers.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400">No customers found.</td></tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:bg-gray-900 transition-colors">
                    <td className="p-4 font-medium text-gray-900 dark:text-white">{c.name}</td>
                    <td className="p-4 text-gray-500">{c.phone}</td>
                    <td className={`p-4 text-right font-bold ${c.total_credit > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>
                      Rs. {Number(c.total_credit).toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <Link href={`/customer/${c.id}`} className="px-4 py-2 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors">
                        📋 View Profile
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageTemplate>
  )
}