'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function SupplierPO() {
  const { branch } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [cart, setCart] = useState([])
  const [poList, setPoList] = useState([])

  useEffect(() => {
    if (!branch) return
    supabase.from('suppliers').select('*').eq('branch_id', branch).then(({ data }) => setSuppliers(data || []))
    supabase.from('branch_products')
      .select('id, price, products(sku, name)')
      .eq('branch_id', branch)
      .then(({ data }) => {
        if (data) setProducts(data.map(p => ({ id: p.id, sku: p.products?.sku, name: p.products?.name, price: p.price })))
      })
    supabase.from('purchase_orders')
      .select('*, suppliers(name)')
      .eq('branch_id', branch)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPoList(data || []))
  }, [branch])

  const addToCart = (prod) => {
    setCart(prev => {
      const exist = prev.find(i => i.id === prod.id)
      if (exist) return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...prod, qty: 1, cost_price: 0 }]
    })
  }

  const createPO = async () => {
    if (!selectedSupplier || cart.length === 0) return alert('Select supplier and items')
    const total = cart.reduce((s, i) => s + i.cost_price * i.qty, 0)
    const { data: po } = await supabase.from('purchase_orders')
      .insert({ branch_id: branch, supplier_id: selectedSupplier.id, total })
      .select().single()
    if (po) {
      await supabase.from('purchase_order_items').insert(
        cart.map(i => ({ purchase_order_id: po.id, product_id: i.id, quantity: i.qty, cost_price: i.cost_price }))
      )
      for (const item of cart) {
        await supabase.rpc('increment_stock', { bp_id: item.id, qty: item.qty })
      }
      alert('PO created & stock updated!')
      setCart([]); setSelectedSupplier(null)
      supabase.from('purchase_orders')
        .select('*, suppliers(name)')
        .eq('branch_id', branch)
        .order('created_at', { ascending: false })
        .then(({ data }) => setPoList(data || []))
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-xl font-bold mb-2">Purchase Orders</h2>
        <select className="select select-bordered w-full mb-2" value={selectedSupplier?.id || ''}
          onChange={e => setSelectedSupplier(suppliers.find(s => s.id === e.target.value))}>
          <option value="">Select Supplier</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          {products.map(p => (
            <button key={p.id} className="btn btn-outline btn-sm h-auto py-2 flex-col" onClick={() => addToCart(p)}>
              <span>{p.name}</span>
              <span className="text-xs">Rs. {p.price}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-bold">Cart</h3>
        {cart.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1 mb-1">
            <span className="flex-1">{item.name}</span>
            <input type="number" className="input input-bordered w-16" placeholder="Qty" value={item.qty}
              onChange={e => { const newCart = [...cart]; newCart[idx].qty = Number(e.target.value); setCart(newCart) }} />
            <input type="number" className="input input-bordered w-20" placeholder="Cost" value={item.cost_price}
              onChange={e => { const newCart = [...cart]; newCart[idx].cost_price = Number(e.target.value); setCart(newCart) }} />
          </div>
        ))}
        <button className="btn btn-primary mt-2" onClick={createPO}>Create PO</button>

        <h3 className="font-bold mt-4">Recent POs</h3>
        {poList.map(po => (
          <div key={po.id} className="text-sm border-b py-1">#{po.id.slice(0,6)} - {po.suppliers?.name} - Rs. {po.total}</div>
        ))}
      </div>
    </div>
  )
}