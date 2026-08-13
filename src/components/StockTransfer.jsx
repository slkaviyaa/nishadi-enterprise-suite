'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import PageTemplate from './PageTemplate';


export default function StockTransfer() {
  const { branch } = useAuth()
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(0)
  const [toBranch, setToBranch] = useState('22222222-2222-2222-2222-222222222222') // Parallel
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.from('branch_products').select('id, stock_quantity, products(name, sku)').eq('branch_id', branch).then(({ data }) => setProducts(data || []))
  }, [branch])

  const transfer = async () => {
    if (!selectedProduct || quantity <= 0) return
    const { error } = await supabase.rpc('transfer_stock', {
      from_bid: branch,
      to_bid: toBranch,
      prod_id: selectedProduct.product_id,
      qty: quantity,
      var_id: null // or variant
    })
    if (error) return setMessage('Error: ' + error.message)
    setMessage('Transfer successful!')
    setQuantity(0)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Stock Transfer</h2>
      <div className="card bg-white dark:bg-gray-800 p-4 shadow">
        <select className="select select-bordered w-full mb-2" value={selectedProduct?.id || ''} onChange={e => setSelectedProduct(products.find(p => p.id === e.target.value))}>
          <option value="">Select Product</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.products?.name} (Stock: {p.stock_quantity})</option>)}
        </select>
        <div className="flex gap-2 mb-2">
          <input type="number" className="input input-bordered w-32" placeholder="Qty" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
          <select className="select select-bordered" value={toBranch} onChange={e => setToBranch(e.target.value)}>
            <option value="11111111-1111-1111-1111-111111111111">Main</option>
            <option value="22222222-2222-2222-2222-222222222222">Parallel</option>
          </select>
          <button className="btn btn-primary" onClick={transfer}>Transfer</button>
        </div>
        {message && <div className="alert alert-info">{message}</div>}
      </div>
    </div>
  )
}