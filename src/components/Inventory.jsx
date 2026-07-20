'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'

export default function Inventory() {
  const { branch } = useAuth()
  const [items, setItems] = useState([])
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newStock, setNewStock] = useState('')

  const loadItems = () => {
    supabase.from('branch_products')
      .select('id, price, stock_quantity, low_stock_threshold, expiry_date, products(sku, name)')
      .eq('branch_id', branch).then(({ data }) => setItems(data || []))
  }

  useEffect(() => { loadItems() }, [branch])

  const addManualProduct = async () => {
    if (!newName || !newPrice) return alert('Name and Price required')
    const sku = 'MANUAL-' + Date.now()
    await supabase.from('products').insert({ sku, name: newName })
    const { data: prod } = await supabase.from('products').select('id').eq('sku', sku).single()
    if (prod) {
      await supabase.from('branch_products').insert({
        branch_id: branch, product_id: prod.id,
        price: Number(newPrice), stock_quantity: Number(newStock) || 0
      })
      alert('Product added!')
      setNewName(''); setNewPrice(''); setNewStock('')
      loadItems()
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      for (const row of data) {
        await supabase.from('products').upsert({ sku: row.sku, name: row.name }, { onConflict: 'sku' })
        const { data: prod } = await supabase.from('products').select('id').eq('sku', row.sku).single()
        if (prod) {
          await supabase.from('branch_products').upsert({
            branch_id: branch, product_id: prod.id,
            price: row.price, stock_quantity: row.stock,
            low_stock_threshold: row.low_stock, expiry_date: row.expiry
          }, { onConflict: 'branch_id,product_id' })
        }
      }
      alert('Import done!'); loadItems()
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Inventory</h2>
        <input type="file" accept=".xlsx,.csv" onChange={handleUpload} className="file-input file-input-bordered" />
      </div>
      <div className="card bg-base-100 p-4">
        <h3 className="font-semibold mb-2">Add Product Manually</h3>
        <div className="flex gap-2">
          <input className="input input-bordered flex-1" placeholder="Product Name" value={newName} onChange={e => setNewName(e.target.value)} />
          <input className="input input-bordered w-24" type="number" placeholder="Price" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
          <input className="input input-bordered w-24" type="number" placeholder="Stock" value={newStock} onChange={e => setNewStock(e.target.value)} />
          <button className="btn btn-primary" onClick={addManualProduct}>Add</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead><tr><th>SKU</th><th>Name</th><th>Price</th><th>Stock</th><th>Low Stock</th><th>Expiry</th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className={i.stock_quantity <= i.low_stock_threshold ? 'bg-red-100' : ''}>
                <td>{i.products?.sku}</td><td>{i.products?.name}</td><td>Rs. {i.price}</td>
                <td>{i.stock_quantity}</td><td>{i.low_stock_threshold}</td>
                <td>{i.expiry_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}