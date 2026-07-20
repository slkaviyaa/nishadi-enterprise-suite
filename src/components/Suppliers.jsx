'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Suppliers() {
  const { branch } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.from('suppliers').select('*').eq('branch_id', branch).then(({ data }) => setSuppliers(data || []))
  }, [branch])

  const addSupplier = async () => {
    if (!name) return alert('Name required')
    await supabase.from('suppliers').insert({ branch_id: branch, name, phone, email })
    setName(''); setPhone(''); setEmail('')
    supabase.from('suppliers').select('*').eq('branch_id', branch).then(({ data }) => setSuppliers(data || []))
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Suppliers</h2>
      <div className="flex gap-2">
        <input className="input input-bordered" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input className="input input-bordered" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
        <input className="input input-bordered" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="btn btn-primary" onClick={addSupplier}>Add</button>
      </div>
      <table className="table w-full">
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th></tr></thead>
        <tbody>
          {suppliers.map(s => (
            <tr key={s.id}><td>{s.name}</td><td>{s.phone}</td><td>{s.email}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}