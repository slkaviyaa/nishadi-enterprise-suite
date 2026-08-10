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

  // Edit Product States
  const [editId, setEditId] = useState(null)
  const [editProductId, setEditProductId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSku, setEditSku] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editStock, setEditStock] = useState('')

  // Manage Item Checkbox States
  const [editTrackProfit, setEditTrackProfit] = useState(true)
  const [editLowStockAlerts, setEditLowStockAlerts] = useState(true)
  const [editAutoUpdateStock, setEditAutoUpdateStock] = useState(true)
  const [editPreventOutOfStock, setEditPreventOutOfStock] = useState(false)
  const [editHasBarcode, setEditHasBarcode] = useState(false)
  const [editTrackExpiry, setEditTrackExpiry] = useState(false)
  const [editAddTax, setEditAddTax] = useState(false)

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
        .select(`
          id, 
          price, 
          cost_price, 
          stock_quantity, 
          products ( 
            id, sku, name, category,
            track_profit, low_stock_alerts, auto_update_stock,
            prevent_out_of_stock_sale, has_barcode, track_expiry, add_tax
          ), 
          product_variants ( variant_value, sku )
        `)
        .eq('branch_id', branch)
        .eq('is_active', true)

      if (error) { 
        console.error('Load error:', error)
        setError('Failed to load: ' + error.message)
        return 
      }

      setItems(data || [])
      setError('')
      calculateTotals(data || [])
    } catch (err) { 
      console.error('Load exception:', err)
      setError('Unexpected error') 
    }
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

  const getColumnValue = (row, possibleNames) => {
    if (!row) return null
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
        return String(row[name]).trim()
      }
    }
    const rowKeys = Object.keys(row)
    for (const target of possibleNames) {
      const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '')
      const foundKey = rowKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget)
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
        return String(row[foundKey]).trim()
      }
    }
    return null
  }

  const handleImport = async () => {
    if (!selectedFile) return alert('Select an Excel file')
    setImporting(true)
    setMessage('⏳ Importing...')
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws)

      if (rows.length > 0) {
        console.log('Excel columns detected:', Object.keys(rows[0]))
      }

      let importedCount = 0
      for (const row of rows) {
        try {
          const itemName = getColumnValue(row, [
            'Item_Name', 'Item Name', 'Product Name', 'ProductName', 
            'Item Description', 'Item_Description', 'Description', 'Particulars', 
            'Name', 'item name', 'item_name'
          ])
          const itemSKU = getColumnValue(row, [
            'Item_SKU', 'Item SKU', 'SKU', 'sku', 
            'Item Code', 'Item_Code', 'Code', 'code', 
            'Product Code', 'Product_Code', 'Part No', 'Part_No', 'Part Number'
          ]) || (itemName ? itemName.replace(/\s+/g, '_').toUpperCase() : null)

          if (!itemName && !itemSKU) continue

          const finalName = itemName || itemSKU
          const finalSKU = itemSKU || finalName.replace(/\s+/g, '_').toUpperCase()
          const category = getColumnValue(row, ['Category', 'category', 'Product Category']) || null
          const barcode = getColumnValue(row, ['Item_Barcode', 'Barcode', 'barcode']) || null

          const { data: prod } = await supabase.from('products')
            .upsert({ sku: finalSKU, name: finalName, category, barcode }, { onConflict: 'sku' })
            .select('id')
            .single()

          if (!prod) continue

          const subItemName = getColumnValue(row, ['SubItem_Name', 'Variant Name', 'SubItem Name', 'Variant'])
          let variantId = null
          if (subItemName) {
            const { data: variant } = await supabase.from('product_variants')
              .upsert({
                product_id: prod.id,
                variant_name: 'SubItem',
                variant_value: subItemName,
                barcode: getColumnValue(row, ['SubItem_barcode', 'Variant Barcode']) || null,
                sku: getColumnValue(row, ['SubItem_SKU', 'Variant SKU']) || null
              }, { onConflict: 'product_id, variant_name, variant_value' })
              .select('id')
              .single()
            variantId = variant?.id
          }

          const price = Number(getColumnValue(row, ['Selling_Price_SubItem', 'Price', 'Selling Price', 'Sell Price', 'SellingPrice']) || 0)
          const cost = Number(getColumnValue(row, ['Cost_Price_SubItem', 'Cost', 'Cost Price', 'Purchase Price', 'CostPrice']) || 0)
          const stock = Number(getColumnValue(row, ['Stock_Count_SubItem', 'Stock', 'Quantity', 'Qty', 'Stock_Count']) || 0)

          const query = supabase.from('branch_products').select('id').eq('branch_id', branch).eq('product_id', prod.id)
          if (variantId) query.eq('variant_id', variantId)
          else query.is('variant_id', null)

          const { data: existing } = await query.maybeSingle()

          if (existing) {
            await supabase.from('branch_products').update({ price, cost_price: cost, stock_quantity: stock }).eq('id', existing.id)
          } else {
            await supabase.from('branch_products').insert({ branch_id: branch, product_id: prod.id, variant_id: variantId, price, cost_price: cost, stock_quantity: stock, is_active: true })
          }
          importedCount++
        } catch (err) {
          console.warn('Row failed:', row, err)
        }
      }
      setMessage(`✅ Import completed! ${importedCount} products updated.`)
      setImporting(false)
      setSelectedFile(null)
      loadItems()
    }
    reader.readAsBinaryString(selectedFile)
  }

  const handleDelete = async (id) => { 
    if (confirm('Delete this product?')) { 
      await supabase.from('branch_products').update({ is_active: false }).eq('id', id)
      loadItems() 
    } 
  }

  const startEdit = (item) => { 
    setEditId(item.id)
    setEditProductId(item.products?.id)
    setEditName(item.products?.name || '')
    setEditSku(item.products?.sku || '')
    setEditCategory(item.products?.category || '')
    setEditPrice(item.price || 0)
    setEditCost(item.cost_price || 0)
    setEditStock(item.stock_quantity || 0)
    setEditTrackProfit(item.products?.track_profit ?? true)
    setEditLowStockAlerts(item.products?.low_stock_alerts ?? true)
    setEditAutoUpdateStock(item.products?.auto_update_stock ?? true)
    setEditPreventOutOfStock(item.products?.prevent_out_of_stock_sale ?? false)
    setEditHasBarcode(item.products?.has_barcode ?? false)
    setEditTrackExpiry(item.products?.track_expiry ?? false)
    setEditAddTax(item.products?.add_tax ?? false)
  }

  const saveEdit = async () => { 
    try {
      if (editProductId) {
        await supabase.from('products').update({
          name: editName, sku: editSku, category: editCategory,
          track_profit: editTrackProfit, low_stock_alerts: editLowStockAlerts, auto_update_stock: editAutoUpdateStock,
          prevent_out_of_stock_sale: editPreventOutOfStock, has_barcode: editHasBarcode, track_expiry: editTrackExpiry, add_tax: editAddTax
        }).eq('id', editProductId)
      }
      await supabase.from('branch_products').update({ price: Number(editPrice), cost_price: Number(editCost), stock_quantity: Number(editStock) }).eq('id', editId)
      setEditId(null)
      loadItems()
    } catch (err) {
      console.error('Error saving item:', err)
    }
  }

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

  const loadMovement = async () => {
    if (!fromDate || !toDate) return
    const { data: products } = await supabase.from('branch_products').select('id, stock_quantity, product_id, products(name, sku)').eq('branch_id', branch).eq('is_active', true)
    if (!products) return
    let result = await Promise.all(products.map(async (p) => {
      const { data: addedData } = await supabase.from('inventory_logs').select('quantity').eq('branch_id', branch).eq('product_id', p.product_id).eq('change_type', 'add').gte('created_at', fromDate).lte('created_at', toDate)
      const added = addedData?.reduce((sum, log) => sum + log.quantity, 0) || 0
      const { data: soldData } = await supabase.from('inventory_logs').select('quantity').eq('branch_id', branch).eq('product_id', p.product_id).eq('change_type', 'sold').gte('created_at', fromDate).lte('created_at', toDate)
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
    <div className="space-y-6 text-gray-900 dark:text-white dark:text-gray-100 p-4">
      {/* 🔴 FIXED: Header is now responsive for mobile using flex-wrap and full width inputs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold dark:text-white">Inventory</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-stretch sm:items-center">
          <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} className="file-input file-input-bordered file-input-sm w-full sm:w-auto" disabled={importing} />
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="btn btn-primary btn-sm flex-1 sm:flex-none" onClick={handleImport} disabled={!selectedFile || importing}>{importing ? '⏳ Importing...' : '📥 Import'}</button>
            <button className="btn btn-sm flex-1 sm:flex-none" onClick={exportToExcel}>📤 Export</button>
            <button className="btn btn-ghost btn-sm" onClick={loadItems}>🔄</button>
          </div>
        </div>
      </div>

      {message && <div className={`alert ${message.includes('completed') ? 'alert-success' : 'alert-info'}`}>{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* MANAGE ITEM MODAL */}
      {editId && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
              <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400">MANAGE ITEM</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setEditId(null)}>✕</button>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="text-xs font-semibold opacity-70">Item Name *</label>
                <input className="input input-bordered w-full font-semibold" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold opacity-70">Variant Name / SKU</label>
                <input className="input input-bordered w-full font-semibold" value={editSku} onChange={e => setEditSku(e.target.value)} placeholder="Variant Name" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold opacity-70">Selling Price *</label>
                  <input type="number" className="input input-bordered w-full font-bold" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold opacity-70">Cost Price</label>
                  <input type="number" className="input input-bordered w-full" value={editCost} onChange={e => setEditCost(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold opacity-70">Stock Available</label>
                <input type="number" className="input input-bordered w-full font-bold" value={editStock} onChange={e => setEditStock(e.target.value)} />
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="edit_track_profit" checked={editTrackProfit} onChange={e => setEditTrackProfit(e.target.checked)} className="checkbox checkbox-sm checkbox-primary" />
                  <label htmlFor="edit_track_profit" className="text-sm cursor-pointer">Track Profit?</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="edit_low_stock" checked={editLowStockAlerts} onChange={e => setEditLowStockAlerts(e.target.checked)} className="checkbox checkbox-sm checkbox-primary" />
                  <label htmlFor="edit_low_stock" className="text-sm cursor-pointer">Low stock alerts?</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="edit_auto_update" checked={editAutoUpdateStock} onChange={e => setEditAutoUpdateStock(e.target.checked)} className="checkbox checkbox-sm checkbox-primary" />
                  <label htmlFor="edit_auto_update" className="text-sm cursor-pointer">Auto-update stock on item sales</label>
                </div>
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <input type="checkbox" id="edit_prevent_stock" checked={editPreventOutOfStock} onChange={e => setEditPreventOutOfStock(e.target.checked)} className="checkbox checkbox-sm checkbox-primary" />
                  <label htmlFor="edit_prevent_stock" className="text-sm font-bold text-blue-700 dark:text-blue-300 cursor-pointer">
                    🔒 Prevent item sale when out of stock?
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="edit_barcode" checked={editHasBarcode} onChange={e => setEditHasBarcode(e.target.checked)} className="checkbox checkbox-sm checkbox-primary" />
                  <label htmlFor="edit_barcode" className="text-sm cursor-pointer">Barcode?</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="edit_expiry" checked={editTrackExpiry} onChange={e => setEditTrackExpiry(e.target.checked)} className="checkbox checkbox-sm checkbox-primary" />
                  <label htmlFor="edit_expiry" className="text-sm cursor-pointer">Track Expiry?</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="edit_tax" checked={editAddTax} onChange={e => setEditAddTax(e.target.checked)} className="checkbox checkbox-sm checkbox-primary" />
                  <label htmlFor="edit_tax" className="text-sm cursor-pointer">Add Tax</label>
                </div>
              </div>
            </div>
            <div className="modal-action mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
              <button className="btn btn-primary flex-1" onClick={saveEdit}>Save Item</button>
              <button className="btn flex-1" onClick={() => setEditId(null)}>Cancel</button>
            </div>
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

      {/* 🔴 FIXED: Category Breakdown header responsive */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h3 className="text-lg font-semibold dark:text-gray-200">📂 Category Breakdown</h3>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={() => setViewMode('cost')} className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-sm font-medium transition ${viewMode === 'cost' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Cost View</button>
            <button onClick={() => setViewMode('sell')} className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-sm font-medium transition ${viewMode === 'sell' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Selling View</button>
            <button className="btn btn-sm flex-1 sm:flex-none" onClick={exportValueReport}>📥 Export</button>
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

      {/* Main Products Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 ">
        <table className="w-full min-w-[800px] divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-800">
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
                <tr key={i.id} className="hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono">{i.products?.sku}</td>
                  <td className="px-4 py-3 text-sm font-medium">{i.products?.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{i.product_variants?.variant_value || '—'}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">Rs. {i.price}</td>
                  <td className="px-4 py-3 text-sm text-right">Rs. {i.cost_price}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${i.stock_quantity <= 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                      {i.stock_quantity}
                    </span>
                  </td>
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

      {/* 🔴 FIXED: Stock Movement inputs responsive */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">Stock Movement Report (Date Range)</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end mb-4">
          <div className="flex-1"><label className="text-sm font-medium">From</label><input type="date" className="input input-bordered w-full" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
          <div className="flex-1"><label className="text-sm font-medium">To</label><input type="date" className="input input-bordered w-full" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
          <button className="btn btn-primary w-full sm:w-auto" onClick={loadMovement}>Load</button>
          {showMovement && movement.length > 0 && <button className="btn btn-sm w-full sm:w-auto" onClick={exportMovement}>📥 Export Report</button>}
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