'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import PageTemplate from './PageTemplate'
import { FiEdit, FiTrash2, FiDownload } from 'react-icons/fi' // Make sure you have react-icons installed

export default function Inventory() {
  const { branch } = useAuth()
  const { settings } = useSettings()
  const { showToast } = useToast()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Date Filters for Stock Movement
  const todayStr = new Date().toISOString().split('T')[0]
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgoStr)
  const [dateTo, setDateTo] = useState(todayStr)
  const [movements, setMovements] = useState([])
  const [reportLoading, setReportLoading] = useState(false)

  // Totals for Metrics
  const [totalAdded, setTotalAdded] = useState(0)
  const [totalSold, setTotalSold] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)
  const [fastMovingList, setFastMovingList] = useState([])

  const currency = settings?.currency_symbol || 'Rs. '

  useEffect(() => {
    if (branch) {
      loadInitialInventory()
    }
  }, [branch])

  // Loads Main Inventory AND Calculates Lifetime Added/Sold for the main table
  const loadInitialInventory = async () => {
    setLoading(true)
    try {
      // 1. Fetch Branch Products
      const { data: bpData, error: bpErr } = await supabase
        .from('branch_products')
        .select('id, price, cost_price, stock_quantity, products!inner(sku, name, deleted_at)')
        .eq('branch_id', branch)
        .is('products.deleted_at', null)

      if (bpErr) throw bpErr

      // 2. Fetch ALL Sales (to show lifetime sold in main table)
      const { data: allSales } = await supabase
        .from('order_items')
        .select('branch_product_id, quantity, orders!inner(branch_id, status)')
        .eq('orders.branch_id', branch)
        .eq('orders.status', 'completed')

      // 3. Fetch ALL Purchase Orders (to show lifetime added in main table)
      const { data: allPOs } = await supabase
        .from('purchase_order_items')
        .select('branch_product_id, quantity, purchase_orders!inner(branch_id)')
        .eq('purchase_orders.branch_id', branch)

      // Calculate lifetime maps
      const lifetimeSoldMap = {}
      ;(allSales || []).forEach(item => {
        lifetimeSoldMap[item.branch_product_id] = (lifetimeSoldMap[item.branch_product_id] || 0) + item.quantity
      })

      const lifetimeAddedMap = {}
      ;(allPOs || []).forEach(item => {
        lifetimeAddedMap[item.branch_product_id] = (lifetimeAddedMap[item.branch_product_id] || 0) + item.quantity
      })

      // Format Products with Lifetime Data
      const formattedProducts = (bpData || []).map(p => ({
        id: p.id,
        sku: p.products?.sku || 'N/A',
        name: p.products?.name || 'Unnamed',
        price: p.price || 0,
        cost: p.cost_price || 0,
        stock: p.stock_quantity || 0,
        lifetimeAdded: lifetimeAddedMap[p.id] || 0,
        lifetimeSold: lifetimeSoldMap[p.id] || 0
      }))

      setProducts(formattedProducts)

      // Calculate Current Balance Stock Sum for top metrics
      const currentBalanceSum = formattedProducts.reduce((sum, p) => sum + p.stock, 0)
      setTotalBalance(currentBalanceSum)

      // Highlight Fast Moving items (Top 4 overall)
      const sortedBySales = [...formattedProducts]
        .filter(p => p.lifetimeSold > 0)
        .sort((a, b) => b.lifetimeSold - a.lifetimeSold)
        .slice(0, 4)
      setFastMovingList(sortedBySales)

    } catch (err) {
      console.error(err)
      showToast('Error loading inventory data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Generates Movement Report for SPECIFIC dates
  const generateMovementReport = async () => {
    setReportLoading(true)
    try {
      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select('branch_product_id, quantity, created_at, orders!inner(status, branch_id)')
        .eq('orders.branch_id', branch)
        .eq('orders.status', 'completed')
        .gte('created_at', `${dateFrom}T00:00:00.000Z`)
        .lte('created_at', `${dateTo}T23:59:59.999Z`)

      const { data: poItemsData } = await supabase
        .from('purchase_order_items')
        .select('branch_product_id, quantity, created_at, purchase_orders!inner(branch_id)')
        .eq('purchase_orders.branch_id', branch)
        .gte('created_at', `${dateFrom}T00:00:00.000Z`)
        .lte('created_at', `${dateTo}T23:59:59.999Z`)

      const salesMap = {}
      let periodSold = 0
      ;(orderItemsData || []).forEach(item => {
        salesMap[item.branch_product_id] = (salesMap[item.branch_product_id] || 0) + item.quantity
        periodSold += item.quantity
      })

      const addedMap = {}
      let periodAdded = 0
      ;(poItemsData || []).forEach(item => {
        addedMap[item.branch_product_id] = (addedMap[item.branch_product_id] || 0) + item.quantity
        periodAdded += item.quantity
      })

      setTotalSold(periodSold)
      setTotalAdded(periodAdded)

      const movementReportList = products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        added: addedMap[p.id] || 0,
        sold: salesMap[p.id] || 0,
        balance: p.stock
      })).filter(m => m.added > 0 || m.sold > 0) // Only show items that moved in this period

      setMovements(movementReportList)
      showToast('Report generated successfully!', 'success')
    } catch (err) {
      console.error(err)
      showToast('Error generating stock movement report', 'error')
    } finally {
      setReportLoading(false)
    }
  }

  const exportCSV = () => {
    if (movements.length === 0) return showToast('No data to export. Please load report first.', 'error')
    
    const headers = ['SKU', 'Item Name', 'Added (+)', 'Sold (-)', 'Current Balance']
    const csvRows = [headers.join(',')]
    
    movements.forEach(m => {
      // Escape commas in names by wrapping in quotes
      const escapedName = `"${m.name.replace(/"/g, '""')}"`
      csvRows.push(`${m.sku},${escapedName},${m.added},${m.sold},${m.balance}`)
    })
    
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Stock_Movement_${dateFrom}_to_${dateTo}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Placeholder functions for actions
  const handleEdit = (id) => showToast(`Edit product ${id} feature coming soon`, 'success')
  const handleDelete = (id) => showToast(`Delete product ${id} feature coming soon`, 'error')

  const metrics = [
    { label: 'Total Stock Balance', value: totalBalance.toLocaleString(), icon: '📦' },
    { label: 'Period Stock Sold', value: totalSold.toLocaleString(), icon: '🛍️' },
    { label: 'Period Stock Added', value: totalAdded.toLocaleString(), icon: '📥' },
    { label: 'Fast Moving Items', value: fastMovingList.length, icon: '🔥' }
  ]

  return (
    <PageTemplate
      title="📦 Inventory & Stock Movement"
      subtitle="Monitor stock balance, analyze fast-moving products, and track movements"
      metrics={metrics}
    >
      <div className="space-y-6 pb-10">

        {/* 🔥 HIGHLIGHTED FAST MOVING PRODUCTS SECTION */}
        {fastMovingList.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-5 rounded-xl border border-orange-200 dark:border-orange-800/50 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🔥</span>
              <h3 className="font-extrabold text-orange-900 dark:text-orange-300 text-base">
                Fast Moving Products (Highest Lifetime Demand)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {fastMovingList.map((item, idx) => (
                <div key={item.id} className="bg-white dark:bg-gray-800 p-3.5 rounded-lg border border-orange-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 px-2 py-0.5 rounded-full uppercase">
                        Rank #{idx + 1}
                      </span>
                      <span className="text-xs font-mono text-gray-400">{item.sku}</span>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white mt-2 line-clamp-1">{item.name}</p>
                  </div>
                  <div className="mt-3 flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500">Units Sold:</span>
                    <span className="font-extrabold text-sm text-orange-600 dark:text-orange-400">{item.lifetimeSold} Pcs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAIN PRODUCTS INVENTORY TABLE (Scrollable & Expanded Data) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h3 className="font-bold text-gray-800 dark:text-white text-base">Current Product Stock Overview</h3>
            <input
              type="text"
              placeholder="🔍 Search SKU or Name..."
              className="w-full sm:w-64 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* 📜 SCROLLABLE WRAPPER */}
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar border border-gray-100 dark:border-gray-700 rounded-lg">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 shadow-sm z-10">
                <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="p-3 border-b dark:border-gray-600">SKU</th>
                  <th className="p-3 border-b dark:border-gray-600">Item Name</th>
                  <th className="p-3 border-b dark:border-gray-600 text-right">Cost Price</th>
                  <th className="p-3 border-b dark:border-gray-600 text-right">Selling Price</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-green-600 bg-green-50/50 dark:bg-green-900/10">Added (+)</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-red-600 bg-red-50/50 dark:bg-red-900/10">Sold (-)</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-blue-600 bg-blue-50/50 dark:bg-blue-900/10">Balance</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {products
                  .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
                  .map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="p-3 font-mono text-xs text-gray-500">{p.sku}</td>
                      <td className="p-3 font-semibold text-gray-900 dark:text-white max-w-[200px] truncate" title={p.name}>{p.name}</td>
                      <td className="p-3 text-right text-gray-600 dark:text-gray-400">{currency}{p.cost.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-gray-800 dark:text-white">{currency}{p.price.toFixed(2)}</td>
                      <td className="p-3 text-center font-bold text-green-600 bg-green-50/30 dark:bg-green-900/10">{p.lifetimeAdded > 0 ? `+${p.lifetimeAdded}` : '0'}</td>
                      <td className="p-3 text-center font-bold text-red-500 bg-red-50/30 dark:bg-red-900/10">{p.lifetimeSold > 0 ? `-${p.lifetimeSold}` : '0'}</td>
                      <td className="p-3 text-center font-extrabold text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/10">{p.stock}</td>
                      <td className="p-3 text-center flex justify-center gap-2">
                        <button onClick={() => handleEdit(p.id)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-md transition"><FiEdit size={14}/></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 rounded-md transition"><FiTrash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 📈 STOCK MOVEMENT REPORT SECTION (With Export CSV) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b pb-4 dark:border-gray-700">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white text-base flex items-center gap-2">
                📈 Filter Stock Movement Report
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Filter by date range and export as CSV</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">From:</span>
                <input
                  type="date"
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">To:</span>
                <input
                  type="date"
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>

              <button
                onClick={generateMovementReport}
                disabled={reportLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-lg transition text-xs shadow-sm disabled:opacity-50"
              >
                {reportLoading ? 'Loading...' : 'Load Report'}
              </button>

              {/* 📥 EXPORT CSV BUTTON */}
              <button
                onClick={exportCSV}
                disabled={movements.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg transition text-xs shadow-sm disabled:opacity-50 flex items-center gap-1"
              >
                <FiDownload size={14}/> Export CSV
              </button>
            </div>
          </div>

          {/* 📜 SCROLLABLE WRAPPER FOR REPORT TABLE */}
          <div className="overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar border border-gray-100 dark:border-gray-700 rounded-lg">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 shadow-sm z-10">
                <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="p-3 border-b dark:border-gray-600">SKU</th>
                  <th className="p-3 border-b dark:border-gray-600">Item Name</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-green-600 bg-green-50/50 dark:bg-green-900/10">Added (+)</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-red-600 bg-red-50/50 dark:bg-red-900/10">Sold (-)</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-900/10">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-400 font-medium">
                      Select dates and click "Load Report" to view movements.
                    </td>
                  </tr>
                ) : (
                  movements.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="p-3 font-mono text-xs text-gray-500">{m.sku}</td>
                      <td className="p-3 font-semibold text-gray-900 dark:text-white max-w-[250px] truncate" title={m.name}>{m.name}</td>
                      <td className="p-3 text-center font-bold text-green-600 bg-green-50/30 dark:bg-green-900/10">
                        {m.added > 0 ? `+${m.added}` : '0'}
                      </td>
                      <td className="p-3 text-center font-bold text-red-500 bg-red-50/30 dark:bg-red-900/10">
                        {m.sold > 0 ? `-${m.sold}` : '0'}
                      </td>
                      <td className="p-3 text-center font-extrabold text-gray-900 dark:text-white bg-blue-50/30 dark:bg-blue-900/10">
                        {m.balance}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </PageTemplate>
  )
}