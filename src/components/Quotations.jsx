'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Quotations() {
  const { branch } = useAuth()
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [cart, setCart] = useState([])
  const [validUntil, setValidUntil] = useState('')
  const [quotes, setQuotes] = useState([])

  useEffect(() => {
    supabase.from('customers').select('*').eq('branch_id', branch).then(({ data }) => setCustomers(data || []))
    supabase.from('branch_products').select('id, price, products(sku, name)').eq('branch_id', branch).then(({ data }) => {
      if (data) setProducts(data.map(p => ({ id: p.id, sku: p.products?.sku, name: p.products?.name, price: p.price })))
    })
    supabase.from('quotations').select('*, customers(name)').eq('branch_id', branch).order('created_at', { ascending: false }).then(({ data }) => setQuotes(data || []))
  }, [branch])

  const addToCart = (prod) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === prod.id)
      if (ex) return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...prod, qty: 1 }]
    })
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const createQuote = async (status = 'draft') => {
    const { data: quote } = await supabase.from('quotations').insert({
      branch_id: branch, customer_id: selectedCustomer?.id, total, status, valid_until: validUntil
    }).select().single()
    if (quote) {
      await supabase.from('quotation_items').insert(cart.map(i => ({ quotation_id: quote.id, product_id: i.id, quantity: i.qty, price: i.price })))
      alert('Quotation created!')
      setCart([]); setSelectedCustomer(null); setValidUntil('')
      supabase.from('quotations').select('*, customers(name)').eq('branch_id', branch).order('created_at', { ascending: false }).then(({ data }) => setQuotes(data || []))
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-xl font-bold mb-2">Quotations</h2>
        <select className="select select-bordered w-full mb-2" value={selectedCustomer?.id || ''} onChange={e => setSelectedCustomer(customers.find(c => c.id === e.target.value))}>
          <option value="">Select Customer</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          {products.map(p => (
            <button key={p.id} className="btn btn-outline btn-sm h-auto py-2 flex-col" onClick={() => addToCart(p)}>
              <span>{p.name}</span><span className="text-xs">Rs. {p.price}</span>
            </button>
          ))}
        </div>
        <input type="date" className="input input-bordered w-full mt-2" value={validUntil} onChange={e => setValidUntil(e.target.value)} placeholder="Valid until" />
      </div>
      <div>
        <h3 className="font-bold">Cart</h3>
        {cart.map((item, idx) => (
          <div key={idx} className="flex justify-between text-sm">{item.name} x{item.qty} <span>Rs. {item.price * item.qty}</span></div>
        ))}
        <p className="font-bold mt-2">Total: Rs. {total}</p>
        <div className="flex gap-2 mt-2">
          <button className="btn btn-primary btn-sm" onClick={() => createQuote('draft')}>Draft</button>
          <button className="btn btn-success btn-sm" onClick={() => createQuote('sent')}>Send</button>
        </div>
        <h3 className="font-bold mt-4">Recent</h3>
        {quotes.map(q => (
          <div key={q.id} className="text-sm border-b py-1">#{q.id.slice(0,6)} - {q.customers?.name} - Rs. {q.total} ({q.status})</div>
        ))}
      </div>
    </div>
  )
}