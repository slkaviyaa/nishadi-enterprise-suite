'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'

export default function Inventory() {
  const { branch } = useAuth()
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  const [importing, setImporting] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editStock, setEditStock] = useState('')

  // Stock movement report
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [movement, setMovement] = useState([])
  const [showMovement, setShowMovement] = useState(false)

  // Total stock value states
  const [totalCostValue, setTotalCostValue] = useState(0)
  const [totalSellValue, setTotalSellValue] = useState(0)
  const [categoryBreakdown, setCategoryBreakdown] = useState([])
  const [viewMode, setViewMode] = useState('sell')

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('branch_products')
        .select(`id, price, cost_price, stock_quantity, products ( sku, name, category ), product_variants ( variant_value, sku )`)
        .eq('branch_id', branch)
        .eq('is_active', true)
      if (error) { console.error('Load error:', error); setError('Failed to load: ' + error.message); return }
      setItems(data || [])
      setError('')
      calculateTotals(data || [])
    } catch (err) { console.error('Load exception:', err); setError('Unexpected error') }
  }

  const calculateTotals = (data) => {
    let costSum = 0, sellSum = 0
    const breakdownMap = {}

    data.forEach(item => {
      const qty = item.stock_quantity || 0
      const cost = item.cost_price || 0
      const price = item.price || 0
      costSum += qty * cost
      sellSum += qty * price

      const category = item.products?.category || 'Uncategorized'
      if (!breakdownMap[category]) {
        breakdownMap[category] = { category, cost_value: 0, sell_value: 0, item_count: 0 }
      }
      breakdownMap[category].cost_value += qty * cost
      breakdownMap[category].sell_value += qty * price
      breakdownMap[category].item_count += 1
    })

    setTotalCostValue(costSum)
    setTotalSellValue(sellSum)
    setCategoryBreakdown(Object.values(breakdownMap))
  }

  useEffect(() => { if (branch) loadItems() }, [branch])

  const handleFileSelect = (e) => setSelectedFile(e.target.files[0])

  const handleImport = async () => {
    if (!selectedFile) return alert('Select an Excel file')
    setImporting(true)
    setMessage('⏳ Importing...')
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws)
      for (const row of rows) {
        try {
          const sku = row['Item_SKU'] || row['Item_Name'].replace(/\s/g, '_')
          const { data: prod } = await supabase.from('products').upsert({ sku, name: row['Item_Name'], category: row['Category'], barcode: row['Item_Barcode'] || null }, { onConflict: 'sku' }).select('id').single()
          if (!prod) continue
          let variantId = null
          if (row['SubItem_Name']) {
            const { data: variant } = await supabase.from('product_variants').upsert({ product_id: prod.id, variant_name: 'SubItem', variant_value: row['SubItem_Name'], barcode: row['SubItem_barcode'] || null, sku: row['SubItem_SKU'] || null }, { onConflict: 'product_id, variant_name, variant_value' }).select('id').single()
            variantId = variant?.id
          }
          const price = Number(row['Selling_Price_SubItem']) || 0
          const cost = Number(row['Cost_Price_SubItem']) || 0
          const stock = Number(row['Stock_Count_SubItem']) || 0
          const query = supabase.from('branch_products').select('id').eq('branch_id', branch).eq('product_id', prod.id)
          if (variantId) query.eq('variant_id', variantId)
          else query.is('variant_id', null)
          const { data: existing } = await query.maybeSingle()
          if (existing) { await supabase.from('branch_products').update({ price, cost_price: cost, stock_quantity: stock }).eq('id', existing.id) }
          else { await supabase.from('branch_products').insert({ branch_id: branch, product_id: prod.id, variant_id: variantId, price, cost_price: cost, stock_quantity: stock, is_active: true }) }
        } catch (err) { console.warn('Row failed:', row['Item_Name'], err) }
      }
      setMessage('✅ Import completed!')
      setImporting(false)
      setSelectedFile(null)
      loadItems()
    }
    reader.readAsBinaryString(selectedFile)
  }

  const handleDelete = async (id) => { if (confirm('Delete this product?')) { await supabase.from('branch_products').update({ is_active: false }).eq('id', id); loadItems() } }

  const startEdit = (item) => { setEditId(item.id); setEditName(item.products?.name || ''); setEditPrice(item.price); setEditCost(item.cost_price); setEditStock(item.stock_quantity) }
  const saveEdit = async () => { await supabase.from('branch_products').update({ price: editPrice, cost_price: editCost, stock_quantity: editStock }).eq('id', editId); setEditId(null); loadItems() }

  const exportToExcel = () => {
    const data = items.map(i => ({
      SKU: i.products?.sku, Name: i.products?.name, Category: i.products?.category,
      Variant: i.product_variants?.variant_value || '', Price: i.price,
      Cost: i.cost_price, Stock: i.stock_quantity,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
    XLSX.writeFile(wb, `inventory_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Stock movement report – only items with movement, product_id fix
  const loadMovement = async () => {
    if (!fromDate || !toDate) return
    const { data: products } = await supabase
      .from('branch_products')
      .select('id, stock_quantity, product_id, products(name, sku)')
      .eq('branch_id', branch)
      .eq('is_active', true)

    if (!products) return

    let result = await Promise.all(products.map(async (p) => {
      const { data: addedData } = await supabase
        .from('inventory_logs')
        .select('quantity')
        .eq('branch_id', branch)
        .eq('product_id', p.product_id)
        .eq('change_type', 'add')
        .gte('created_at', fromDate)
        .lte('created_at', toDate)
      const added = addedData?.reduce((sum, log) => sum + log.quantity, 0) || 0

      const { data: soldData } = await supabase
        .from('inventory_logs')
        .select('quantity')
        .eq('branch_id', branch)
        .eq('product_id', p.product_id)
        .eq('change_type', 'sold')
        .gte('created_at', fromDate)
        .lte('created_at', toDate)
      const sold = soldData?.reduce((sum, log) => sum + Math.abs(log.quantity), 0) || 0

      return { sku: p.products?.sku, name: p.products?.name, added, sold, balance: p.stock_quantity }
    }))

    result = result.filter(r => r.added > 0 || r.sold > 0)
    setMovement(result)
    setShowMovement(true)
  }

  const exportMovement = () => {
    const data = movement.map(m => ({ SKU: m.sku, Name: m.name, Added: m.added, Sold: m.sold, Balance: m.balance }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'StockMovement')
    XLSX.writeFile(wb, `stock_movement_${fromDate}_${toDate}.xlsx`)
  }

  const exportValueReport = () => {
    const data = categoryBreakdown.map(c => ({ Category: c.category, 'Cost Value': c.cost_value, 'Sell Value': c.sell_value, Items: c.item_count }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'InventoryValue')
    XLSX.writeFile(wb, `inventory_value_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-2xl font-bold dark:text-white">Inventory</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} className="file-input file-input-bordered file-input-sm" disabled={importing} />
          <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={!selectedFile || importing}>{importing ? '⏳ Importing...' : '📥 Import Excel'}</button>
          <button className="btn btn-sm" onClick={exportToExcel}>📤 Export Excel</button>
          <button className="btn btn-ghost btn-sm" onClick={loadItems}>🔄</button>
        </div>
      </div>

      {message && <div className={`alert ${message.includes('completed') ? 'alert-success' : 'alert-info'}`}>{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {editId && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-2">Edit Product</h3>
            <input className="input input-bordered w-full mb-2" value={editName} disabled />
            <div className="flex gap-2 mb-2">
              <input type="number" className="input input-bordered w-1/2" placeholder="Price" value={editPrice} onChange={e => setEditPrice(Number(e.target.value))} />
              <input type="number" className="input input-bordered w-1/2" placeholder="Cost" value={editCost} onChange={e => setEditCost(Number(e.target.value))} />
            </div>
            <input type="number" className="input input-bordered w-full mb-2" placeholder="Stock" value={editStock} onChange={e => setEditStock(Number(e.target.value))} />
            <div className="modal-action"><button className="btn btn-primary" onClick={saveEdit}>Save</button><button className="btn" onClick={() => setEditId(null)}>Cancel</button></div>
          </div>
        </div>
      )}

      {/* Total Stock Value Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold mb-2 dark:text-gray-200">💰 Total Stock Value (At Cost)</h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">Rs. {totalCostValue.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold mb-2 dark:text-gray-200">💵 Total Stock Value (Selling Price)</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">Rs. {totalSellValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold dark:text-gray-200">📂 Category Breakdown</h3>
          <div className="flex gap-2">
            <button onClick={() => setViewMode('cost')} className={`px-3 py-1 rounded-lg text-sm font-medium transition ${viewMode === 'cost' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Cost View</button>
            <button onClick={() => setViewMode('sell')} className={`px-3 py-1 rounded-lg text-sm font-medium transition ${viewMode === 'sell' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Selling View</button>
            <button className="btn btn-sm" onClick={exportValueReport}>📥 Export</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead><tr className="dark:text-gray-300"><th>Category</th><th className="text-right">Total {viewMode === 'cost' ? 'Cost' : 'Selling'} Value</th><th className="text-right">Items</th></tr></thead>
            <tbody>
              {categoryBreakdown.map((cat, idx) => (
                <tr key={idx} className="dark:text-gray-200"><td className="font-medium">{cat.category}</td><td className="text-right font-semibold">Rs. {(viewMode === 'cost' ? cat.cost_value : cat.sell_value).toLocaleString()}</td><td className="text-right">{cat.item_count}</td></tr>
              ))}
              {categoryBreakdown.length === 0 && <tr><td colSpan={3} className="text-center py-4 opacity-50">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Products Table – Beautiful, Responsive */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full min-w-[800px] divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Variant</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cost</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {items.length === 0 && !error ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">📦 No products found. Import an Excel file or add manually.</td></tr>
            ) : (
              items.map(i => (
                <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono">{i.products?.sku}</td>
                  <td className="px-4 py-3 text-sm font-medium">{i.products?.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{i.product_variants?.variant_value || '—'}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">Rs. {i.price}</td>
                  <td className="px-4 py-3 text-sm text-right">Rs. {i.cost_price}</td>
                  <td className="px-4 py-3 text-sm text-right">{i.stock_quantity}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition" onClick={() => startEdit(i)}>✏️ Edit</button>
                      <button className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition" onClick={() => handleDelete(i.id)}>🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stock Movement Report */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">Stock Movement Report (Date Range)</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-end mb-4">
          <div><label className="text-sm font-medium">From</label><input type="date" className="input input-bordered w-full" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
          <div><label className="text-sm font-medium">To</label><input type="date" className="input input-bordered w-full" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={loadMovement}>Load</button>
          {showMovement && movement.length > 0 && <button className="btn btn-sm" onClick={exportMovement}>📥 Export Report</button>}
        </div>
        {showMovement && movement.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead><tr><th>SKU</th><th>Name</th><th>Added</th><th>Sold</th><th>Balance</th></tr></thead>
              <tbody>{movement.map((m, idx) => (<tr key={idx}><td>{m.sku}</td><td>{m.name}</td><td>{m.added}</td><td>{m.sold}</td><td>{m.balance}</td></tr>))}</tbody>
            </table>
          </div>
        )}
        {showMovement && movement.length === 0 && <p className="text-sm opacity-50 text-center">No stock movement during this period.</p>}
      </div>
    </div>
  )
}