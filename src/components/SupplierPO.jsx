'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageTemplate from './PageTemplate'

export default function SupplierPO() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [recentPOs, setRecentPOs] = useState([])
  
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch initial data
  useEffect(() => {
    if (!branch) return
    
    // Load Suppliers
    supabase.from('suppliers').select('*').eq('branch_id', branch).then(({ data }) => setSuppliers(data || []))
    
    // Load Products
    supabase.from('branch_products')
      .select('id, cost_price, stock_quantity, products(sku, name)')
      .eq('branch_id', branch)
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) {
          setProducts(data.map(p => ({
            id: p.id,
            name: p.products?.name,
            sku: p.products?.sku,
            cost: p.cost_price || 0,
            stock: p.stock_quantity || 0
          })))
        }
      })

    loadRecentPOs()
  }, [branch])

  const loadRecentPOs = () => {
    supabase.from('purchase_orders')
      .select('*, suppliers(name)')
      .eq('branch_id', branch)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setRecentPOs(data || []))
  }

  // Cart Functions
  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id)
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item))
    } else {
      setCart([...cart, { ...product, qty: 1 }])
    }
  }

  const updateCartQty = (id, qty) => {
    if (qty < 1) return
    setCart(cart.map(item => item.id === id ? { ...item, qty: Number(qty) } : item))
  }

  const updateCartCost = (id, cost) => {
    if (cost < 0) return
    setCart(cart.map(item => item.id === id ? { ...item, cost: Number(cost) } : item))
  }

  const removeFromCart = (id) => setCart(cart.filter(item => item.id !== id))

  const subtotal = cart.reduce((sum, item) => sum + (item.cost * item.qty), 0)

  // Submit PO
  const createPO = async () => {
    if (!selectedSupplier) return showToast('Please select a supplier', 'error')
    if (cart.length === 0) return showToast('Cart is empty', 'error')
    
    setLoading(true)
    try {
      // 1. Create Purchase Order
      const { data: po, error: poError } = await supabase.from('purchase_orders').insert({
        branch_id: branch,
        supplier_id: selectedSupplier,
        total_amount: subtotal,
        status: 'pending' // pending, received, cancelled
      }).select().single()

      if (poError) throw poError

      // 2. Insert PO Items
      const poItems = cart.map(item => ({
        po_id: po.id,
        branch_product_id: item.id,
        quantity: item.qty,
        unit_cost: item.cost,
        total_cost: item.qty * item.cost
      }))

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(poItems)
      if (itemsError) throw itemsError

      showToast('Purchase Order created successfully!', 'success')
      setCart([])
      setSelectedSupplier('')
      loadRecentPOs()
      
    } catch (error) {
      console.error(error)
      showToast('Error creating PO. Check database tables.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const metrics = [
    { label: 'Total POs (Recent)', value: recentPOs.length, icon: '📋' },
    { label: 'Cart Items', value: cart.length, icon: '🛒' },
    { label: 'Estimated Total', value: `Rs. ${subtotal.toLocaleString()}`, icon: '💰' },
  ]

  return (
    <PageTemplate
      title="🚚 Purchase Orders"
      subtitle="Create and manage purchase orders to restock inventory from suppliers"
      metrics={metrics}
    >
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        
        {/* LEFT COLUMN: Product Selection */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <input 
              type="text" 
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition" 
              placeholder="🔍 Search products to order..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
            <h3 className="font-bold text-gray-800 dark:text-white mb-3">Available Products</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())).map(p => (
                <button 
                  key={p.id} 
                  onClick={() => addToCart(p)}
                  className="text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition flex flex-col gap-1"
                >
                  <span className="font-semibold text-gray-900 dark:text-white line-clamp-1">{p.name}</span>
                  <span className="text-xs text-gray-500">SKU: {p.sku || 'N/A'}</span>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm font-bold text-blue-600">Cost: Rs.{p.cost}</span>
                    <span className="text-xs font-medium bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded">Stock: {p.stock}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PO Cart & Supplier */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col flex-1">
            
            <h3 className="font-bold text-gray-800 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Purchase Order Details</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Select Supplier *</label>
              <select 
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={selectedSupplier}
                onChange={e => setSelectedSupplier(e.target.value)}
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[200px] mb-4 pr-1 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  Cart is empty. Select products from the left.
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{item.name}</p>
                      </div>
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex flex-col w-20">
                          <label className="text-[10px] text-gray-500">Qty</label>
                          <input type="number" min="1" className="border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm bg-white dark:bg-gray-600 outline-none" value={item.qty} onChange={e => updateCartQty(item.id, e.target.value)} />
                        </div>
                        <div className="flex flex-col w-24">
                          <label className="text-[10px] text-gray-500">Unit Cost</label>
                          <input type="number" min="0" className="border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm bg-white dark:bg-gray-600 outline-none" value={item.cost} onChange={e => updateCartCost(item.id, e.target.value)} />
                        </div>
                        <div className="flex flex-col w-24 text-right">
                          <label className="text-[10px] text-gray-500">Total</label>
                          <span className="font-bold text-sm">Rs. {(item.qty * item.cost).toLocaleString()}</span>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-gray-600 rounded-lg ml-1 mt-3 transition-colors">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center mb-4">
              <span className="font-semibold text-blue-800 dark:text-blue-300">Estimated Total:</span>
              <span className="text-xl font-extrabold text-blue-700 dark:text-blue-400">Rs. {subtotal.toLocaleString()}</span>
            </div>

            <button 
              onClick={createPO}
              disabled={loading || cart.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-md disabled:opacity-50"
            >
              {loading ? 'Processing...' : '📝 Create Purchase Order'}
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM: Recent POs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <h3 className="font-bold text-gray-800 dark:text-white">Recent Purchase Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="text-xs font-semibold text-gray-500 uppercase border-b dark:border-gray-700">
                <th className="p-4">Date</th>
                <th className="p-4">PO ID</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
              {recentPOs.length === 0 ? (
                <tr><td colSpan="5" className="p-6 text-center text-gray-400">No recent purchase orders found.</td></tr>
              ) : (
                recentPOs.map(po => (
                  <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="p-4 text-gray-600 dark:text-gray-300">{new Date(po.created_at).toLocaleDateString()}</td>
                    <td className="p-4 font-mono text-xs text-gray-500">#{po.id.slice(0,8)}</td>
                    <td className="p-4 font-medium text-gray-800 dark:text-white">{po.suppliers?.name || 'Unknown'}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded text-xs font-bold uppercase tracking-wider">
                        {po.status}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-gray-800 dark:text-white">Rs. {Number(po.total_amount).toLocaleString()}</td>
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