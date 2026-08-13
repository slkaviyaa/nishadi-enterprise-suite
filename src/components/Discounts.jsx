'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import PageTemplate from './PageTemplate';

export default function Discounts() {
  const { branch } = useAuth()
  const [schemas, setSchemas] = useState([])
  const [name, setName] = useState('')
  const [type, setType] = useState('percentage')
  const [value, setValue] = useState(0)
  const [minAmount, setMinAmount] = useState(0)

  useEffect(() => {
    supabase.from('discount_schemas').select('*').eq('branch_id', branch).then(({ data }) => setSchemas(data || []))
  }, [branch])

  const add = async () => {
    if(!name || value <= 0) return alert('Fill required fields')
    await supabase.from('discount_schemas').insert({ branch_id: branch, name, type, value, min_amount: minAmount })
    setName(''); setValue(0); setMinAmount(0)
    supabase.from('discount_schemas').select('*').eq('branch_id', branch).then(({ data }) => setSchemas(data || []))
  }

  const metrics = [
    { label: 'Total Schemas', value: schemas.length, icon: '🏷️' },
    { label: 'Active Schemas', value: schemas.filter(s => s.is_active).length, icon: '✅' },
  ]

  return (
    <PageTemplate
      title="🏷️ Discount Schemas"
      subtitle="Create and manage global discount rules for POS"
      metrics={metrics}
    >
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-white">Create Discount Schema</h3>
          <div className="flex flex-wrap gap-3">
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-1 min-w-[150px]" placeholder="Schema Name" value={name} onChange={e => setName(e.target.value)} />
            <select className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={type} onChange={e => setType(e.target.value)}>
              <option value="percentage">Percentage %</option>
              <option value="flat">Flat Rs.</option>
            </select>
            <input type="number" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-24" placeholder="Value" value={value || ''} onChange={e => setValue(Number(e.target.value))} />
            <input type="number" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-28" placeholder="Min Total" value={minAmount || ''} onChange={e => setMinAmount(Number(e.target.value))} />
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shadow-sm" onClick={add}>+ Add Schema</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                  <th className="p-3">Schema Name</th><th className="p-3">Type</th><th className="p-3">Value</th><th className="p-3">Min Order Total</th><th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700 text-sm">
                {schemas.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 capitalize">{s.type}</td>
                    <td className="p-3 font-bold text-blue-600">{s.type === 'percentage' ? `${s.value}%` : `Rs. ${s.value}`}</td>
                    <td className="p-3">Rs. {s.min_amount}</td>
                    <td className="p-3 text-center">
                      <button className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                        onClick={async () => {
                          await supabase.from('discount_schemas').update({ is_active: !s.is_active }).eq('id', s.id)
                          supabase.from('discount_schemas').select('*').eq('branch_id', branch).then(({ data }) => setSchemas(data || []))
                        }}>
                        {s.is_active ? '✅ Active' : '❌ Inactive'}
                      </button>
                    </td>
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