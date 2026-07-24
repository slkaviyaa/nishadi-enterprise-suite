'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

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
    await supabase.from('discount_schemas').insert({ branch_id: branch, name, type, value, min_amount: minAmount })
    setName(''); setValue(0); setMinAmount(0)
    supabase.from('discount_schemas').select('*').eq('branch_id', branch).then(({ data }) => setSchemas(data || []))
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Discount Schemas</h2>
      <div className="card bg-white dark:bg-gray-800 p-4 shadow">
        <div className="flex gap-2 mb-2">
          <input className="input input-bordered flex-1" placeholder="Schema Name" value={name} onChange={e => setName(e.target.value)} />
          <select className="select select-bordered" value={type} onChange={e => setType(e.target.value)}>
            <option value="percentage">Percentage %</option>
            <option value="flat">Flat Rs.</option>
          </select>
          <input type="number" className="input input-bordered w-24" placeholder="Value" value={value} onChange={e => setValue(Number(e.target.value))} />
          <input type="number" className="input input-bordered w-24" placeholder="Min Total" value={minAmount} onChange={e => setMinAmount(Number(e.target.value))} />
          <button className="btn btn-primary" onClick={add}>Add</button>
        </div>
        <table className="table w-full">
          <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Min Total</th><th>Active</th></tr></thead>
          <tbody>
            {schemas.map(s => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.type}</td><td>{s.value}</td><td>Rs. {s.min_amount}</td>
                <td>
                  <button className={`btn btn-xs ${s.is_active ? 'btn-success' : 'btn-outline'}`}
                    onClick={async () => {
                      await supabase.from('discount_schemas').update({ is_active: !s.is_active }).eq('id', s.id)
                      supabase.from('discount_schemas').select('*').eq('branch_id', branch).then(({ data }) => setSchemas(data || []))
                    }}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}