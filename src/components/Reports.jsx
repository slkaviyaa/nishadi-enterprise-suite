'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import * as XLSX from 'xlsx'
import PageTemplate from './PageTemplate';

export default function Reports() {
  const { branch } = useAuth()
  const { settings } = useSettings()
  const currency = settings?.currency_symbol || 'Rs. '

  const [loading, setLoading] = useState(false)
  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  
  // Date Filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [activeFilter, setActiveFilter] = useState('month')

  // Load Data based on dates
  const loadReportData = async (start, end) => {
    if (!branch) return
    setLoading(true)
    
    // Fetch Sales (Completed Orders)
    const { data: salesData } = await supabase
      .from('orders')
      .select('id, created_at, total, payment_method, tax_amount, discount_amount')
      .eq('branch_id', branch)
      .eq('status', 'completed')
      .gte('created_at', start + 'T00:00:00.000Z')
      .lte('created_at', end + 'T23:59:59.999Z')
      .order('created_at', { ascending: false })

    // Fetch Expenses
    const { data: expensesData } = await supabase
      .from('expenses')
      .select('id, created_at, category, amount, description')
      .eq('branch_id', branch)
      .gte('created_at', start + 'T00:00:00.000Z')
      .lte('created_at', end + 'T23:59:59.999Z')
      .order('created_at', { ascending: false })

    setSales(salesData || [])
    setExpenses(expensesData || [])
    setLoading(false)
  }

  // Quick Date Filters Logic
  const applyQuickFilter = (type) => {
    setActiveFilter(type)
    const today = new Date()
    let start = new Date()
    
    if (type === 'today') {
      start = today
    } else if (type === 'week') {
      start.setDate(today.getDate() - today.getDay())
    } else if (type === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
    } else if (type === 'year') {
      start = new Date(today.getFullYear(), 0, 1)
    }

    const startStr = start.toISOString().split('T')[0]
    const endStr = today.toISOString().split('T')[0]
    
    setFromDate(startStr)
    setToDate(endStr)
    loadReportData(startStr, endStr)
  }

  useEffect(() => {
    if (branch) applyQuickFilter('month')
  }, [branch])

  const handleCustomSearch = () => {
    setActiveFilter('custom')
    if (fromDate && toDate) loadReportData(fromDate, toDate)
  }

  const totalSales = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const totalTaxCollected = sales.reduce((sum, s) => sum + (Number(s.tax_amount) || 0), 0)
  const netProfit = totalSales - totalExpenses

  // 📥 Professional Full Business & Tax Report Export (6 Sheets)
  const exportToExcel = async () => {
    if (!branch) return

    const { data: invData } = await supabase.from('branch_products').select('price, cost_price, stock_quantity, products(name, sku, category)').eq('branch_id', branch).eq('is_active', true)
    const { data: custData } = await supabase.from('customers').select('name, phone, address, total_credit').eq('branch_id', branch)
    const { data: bankData } = await supabase.from('bank_ledger').select('bank_name, account_number, description, amount, type, created_at').eq('branch_id', branch)

    const totalInventoryCost = (invData || []).reduce((sum, i) => sum + ((i.stock_quantity || 0) * (i.cost_price || 0)), 0)
    const totalInventorySell = (invData || []).reduce((sum, i) => sum + ((i.stock_quantity || 0) * (i.price || 0)), 0)
    const totalCustomerCredit = (custData || []).reduce((sum, c) => sum + (Number(c.total_credit) || 0), 0)

    const summaryData = [
      ["NISHADI MOTORS - COMPLETE BUSINESS & TAX AUDIT REPORT"],
      [`Reporting Period: ${fromDate} to ${toDate}`],
      [],
      ["FINANCIAL OVERVIEW", "AMOUNT (Rs.)"],
      ["Total Sales Revenue", totalSales],
      ["Total Tax Collected", totalTaxCollected],
      ["Total Expenses", totalExpenses],
      ["Net Profit", netProfit],
      ["Total Orders Processed", sales.length],
      [],
      ["ASSET & LIABILITY OVERVIEW", "AMOUNT (Rs.)"],
      ["Total Inventory Value (Cost)", totalInventoryCost],
      ["Total Inventory Value (Retail)", totalInventorySell],
      ["Total Outstanding Customer Credit", totalCustomerCredit]
    ]

    const salesExport = sales.map(s => ({
      'Date': new Date(s.created_at).toLocaleDateString(),
      'Time': new Date(s.created_at).toLocaleTimeString(),
      'Order ID': s.id,
      'Payment Method': s.payment_method?.toUpperCase() || 'CASH',
      'Tax (Rs.)': s.tax_amount || 0,
      'Discount (Rs.)': s.discount_amount || 0,
      'Total (Rs.)': s.total
    }))

    const expensesExport = expenses.map(e => ({
      'Date': new Date(e.created_at).toLocaleDateString(),
      'Category': e.category,
      'Description': e.description || '-',
      'Amount (Rs.)': e.amount
    }))

    const inventoryExport = (invData || []).map(i => ({
      'SKU': i.products?.sku || '',
      'Product Name': i.products?.name || '',
      'Category': i.products?.category || 'Uncategorized',
      'Stock Qty': i.stock_quantity || 0,
      'Cost Price (Rs.)': i.cost_price || 0,
      'Selling Price (Rs.)': i.price || 0,
      'Total Cost Value (Rs.)': (i.stock_quantity || 0) * (i.cost_price || 0),
      'Total Retail Value (Rs.)': (i.stock_quantity || 0) * (i.price || 0)
    }))

    const customersExport = (custData || []).map(c => ({
      'Customer Name': c.name,
      'Phone': c.phone,
      'Address': c.address || '-',
      'Outstanding Credit (Rs.)': c.total_credit || 0
    }))

    const bankExport = (bankData || []).map(b => ({
      'Date': new Date(b.created_at).toLocaleDateString(),
      'Bank Name': b.bank_name,
      'Account No': b.account_number || '-',
      'Type': b.type.toUpperCase(),
      'Description': b.description || '-',
      'Amount (Rs.)': b.amount
    }))

    const wb = XLSX.utils.book_new()
    
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    const wsSales = XLSX.utils.json_to_sheet(salesExport)
    const wsExpenses = XLSX.utils.json_to_sheet(expensesExport)
    const wsInventory = XLSX.utils.json_to_sheet(inventoryExport)
    const wsCustomers = XLSX.utils.json_to_sheet(customersExport)
    const wsBank = XLSX.utils.json_to_sheet(bankExport)

    const setColWidths = (ws) => {
      const range = XLSX.utils.decode_range(ws['!ref'])
      const cols = []
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxLen = 10
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cell = ws[XLSX.utils.encode_cell({c: C, r: R})]
          if (cell && cell.v) maxLen = Math.max(maxLen, String(cell.v).length)
        }
        cols.push({wch: maxLen + 4})
      }
      ws['!cols'] = cols
    }

    [wsSummary, wsSales, wsExpenses, wsInventory, wsCustomers, wsBank].forEach(setColWidths)

    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary")
    XLSX.utils.book_append_sheet(wb, wsSales, "Sales Records")
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Expenses Records")
    XLSX.utils.book_append_sheet(wb, wsInventory, "Inventory Valuation")
    XLSX.utils.book_append_sheet(wb, wsCustomers, "Customer Credit Ledger")
    XLSX.utils.book_append_sheet(wb, wsBank, "Bank Transactions")

    XLSX.writeFile(wb, `Nishadi_Motors_Full_Audit_Report_${fromDate}_to_${toDate}.xlsx`)
  }

  const metrics = [
    { label: 'Total Sales Revenue', value: `${currency}${totalSales.toLocaleString()}`, icon: '💰' },
    { label: 'Total Expenses', value: `${currency}${totalExpenses.toLocaleString()}`, icon: '📉' },
    { label: 'Net Profit', value: `${currency}${netProfit.toLocaleString()}`, icon: '🏛️' },
    { label: 'Tax Collected', value: `${currency}${totalTaxCollected.toLocaleString()}`, icon: '🧾' },
  ]

  const actions = (
    <button 
      onClick={exportToExcel} 
      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-colors text-xs sm:text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
    >
      📥 Export Full Audit Excel
    </button>
  )

  return (
    <PageTemplate
      title="📊 Advanced Financial Reports"
      subtitle="Analyze sales, expenses, and generate full tax-ready Excel reports"
      metrics={metrics}
      actions={actions}
    >
      <div className="space-y-6">
        
        {/* Filters Section - Fully Responsive */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
            
            {/* Quick Filters */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <button onClick={() => applyQuickFilter('today')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeFilter === 'today' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}>Today</button>
              <button onClick={() => applyQuickFilter('week')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeFilter === 'week' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}>This Week</button>
              <button onClick={() => applyQuickFilter('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeFilter === 'month' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}>This Month</button>
              <button onClick={() => applyQuickFilter('year')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeFilter === 'year' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}>This Year</button>
            </div>

            {/* Custom Date Range */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-gray-500">Custom Range:</span>
              <div className="flex items-center gap-2">
                <input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <span className="text-gray-400">-</span>
                <input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
              <button onClick={handleCustomSearch} className="bg-gray-800 hover:bg-gray-900 dark:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition mt-2 sm:mt-0">Search</button>
            </div>
            
          </div>
        </div>

        {/* Data Tables Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Sales Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 dark:text-white text-sm sm:text-base">Recent Sales ({sales.length})</h3>
              <span className="text-xs sm:text-sm font-bold text-green-600">{currency}{totalSales.toLocaleString()}</span>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left min-w-[300px]">
                <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm">
                  <tr className="text-xs font-semibold text-gray-500 uppercase border-b dark:border-gray-700">
                    <th className="p-3">Date</th>
                    <th className="p-3">Method</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs sm:text-sm">
                  {loading ? <tr><td colSpan="3" className="p-8 text-center text-gray-400">Loading data...</td></tr> : 
                   sales.length === 0 ? <tr><td colSpan="3" className="p-8 text-center text-gray-400">No sales in this period.</td></tr> :
                   sales.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="p-3 text-gray-600 dark:text-gray-300">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="p-3"><span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-bold uppercase">{s.payment_method || 'CASH'}</span></td>
                      <td className="p-3 text-right font-bold text-gray-800 dark:text-white">{currency}{Number(s.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 dark:text-white text-sm sm:text-base">Recent Expenses ({expenses.length})</h3>
              <span className="text-xs sm:text-sm font-bold text-red-600">{currency}{totalExpenses.toLocaleString()}</span>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left min-w-[300px]">
                <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm">
                  <tr className="text-xs font-semibold text-gray-500 uppercase border-b dark:border-gray-700">
                    <th className="p-3">Date</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs sm:text-sm">
                  {loading ? <tr><td colSpan="3" className="p-8 text-center text-gray-400">Loading data...</td></tr> : 
                   expenses.length === 0 ? <tr><td colSpan="3" className="p-8 text-center text-gray-400">No expenses in this period.</td></tr> :
                   expenses.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="p-3 text-gray-600 dark:text-gray-300">{new Date(e.created_at).toLocaleDateString()}</td>
                      <td className="p-3 font-medium text-gray-800 dark:text-gray-200">{e.category}</td>
                      <td className="p-3 text-right font-bold text-red-600">{currency}{Number(e.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </PageTemplate>
  )
}