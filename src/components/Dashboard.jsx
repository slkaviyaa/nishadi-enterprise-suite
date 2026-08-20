'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import Link from 'next/link'
import PageTemplate from './PageTemplate';

export default function Dashboard() {
  const { branch: currentBranch } = useAuth()
  const { settings } = useSettings()
  const [stats, setStats] = useState({ sales: 0, customers: 0, products: 0, expenses: 0 })
  const [overdueCredits, setOverdueCredits] = useState([])
  const [lowStockItems, setLowStockItems] = useState([])

  useEffect(() => {
    if (!currentBranch) return

    // Stats
    supabase.from('orders').select('total').eq('branch_id', currentBranch).eq('status','completed')
      .gte('created_at', new Date().toISOString().split('T')[0])
      .then(({ data }) => { if (data) setStats(prev => ({ ...prev, sales: data.reduce((s,o)=>s+o.total,0) })) })
    
    supabase.from('customers').select('*', { count:'exact', head:true }).eq('branch_id', currentBranch)
      .then(({ count }) => setStats(prev => ({ ...prev, customers: count||0 })))
    
    supabase.from('branch_products').select('*', { count:'exact', head:true }).eq('branch_id', currentBranch).eq('is_active', true)
      .then(({ count }) => setStats(prev => ({ ...prev, products: count||0 })))
    
    supabase.from('expenses').select('amount').eq('branch_id', currentBranch)
      .gte('created_at', new Date().toISOString().split('T')[0])
      .then(({ data }) => { if (data) setStats(prev => ({ ...prev, expenses: data.reduce((s,e)=>s+e.amount,0) })) })
    
    // Overdue credits
    supabase.from('credit_transactions').select('id, amount, due_date, customers(name, phone)')
      .eq('branch_id', currentBranch).eq('type','purchase')
      .lt('due_date', new Date().toISOString().split('T')[0])
      .order('due_date').then(({ data }) => setOverdueCredits(data || []))
    
    // 🔥 FIXED: Low stock items - filter active & not deleted
    const lowStockThreshold = settings?.low_stock_threshold || 5; // threshold එක settings එකෙන් හෝ default 5

    supabase.from('branch_products')
      .select(`
        id,
        stock_quantity,
        products:products!inner(name)
      `)
      .eq('branch_id', currentBranch)
      .eq('is_active', true)                  // Active products only
      .is('products.deleted_at', null)        // Product deleted_at NULL (not deleted)
      .lt('stock_quantity', lowStockThreshold) // Stock එක threshold ට වඩා අඩු
      .then(({ data, error }) => {
        if (error) {
          console.error('Low stock query error:', error)
          setLowStockItems([])
          return
        }
        const mapped = (data || []).map(item => ({
          product_name: item.products?.name || 'Unknown',
          stock_quantity: item.stock_quantity
        }))
        setLowStockItems(mapped)
      })
  }, [currentBranch, settings])

  const currency = settings?.currency_symbol || 'Rs. '
  const shortcuts = [
    { href: '/pos', label: '🛒 POS System', bg: 'bg-blue-600', icon: '💻' },
    { href: '/inventory', label: '📦 Inventory', bg: 'bg-purple-600', icon: '📊' },
    { href: '/customers', label: '👥 Customers', bg: 'bg-pink-600', icon: '🤝' },
    { href: '/reports', label: '📊 Reports', bg: 'bg-teal-600', icon: '📈' },
    { href: '/staff', label: '👨‍💼 Staff', bg: 'bg-orange-500', icon: '👤' },
    { href: '/shop', label: '🛍️ Shop Front', bg: 'bg-green-600', icon: '🏪' },
  ].filter(s => {
    if (s.href==='/pos' && settings?.pos_enabled===false) return false
    if (s.href==='/inventory' && settings?.inventory_enabled===false) return false
    if (s.href==='/customers' && settings?.customers_enabled===false) return false
    if (s.href==='/reports' && settings?.reports_enabled===false) return false
    if (s.href==='/staff' && settings?.staff_enabled===false) return false
    if (s.href==='/shop' && settings?.shop_enabled===false) return false
    return true
  })

  const metrics = [
    { label: "Today's Sales", value: `${currency}${stats.sales.toLocaleString()}`, icon: '💰' },
    { label: "Total Customers", value: stats.customers, icon: '👥' },
    { label: "Active Products", value: stats.products, icon: '📦' },
    { label: "Today's Expenses", value: `${currency}${stats.expenses.toLocaleString()}`, icon: '📉' },
  ]

  return (
    <PageTemplate
      title="📊 Main Dashboard"
      subtitle="Overview of your daily business metrics and alerts"
      metrics={metrics}
    >
      <div className="space-y-6 animate-fadeIn">
        
        {/* Alerts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚠️</span>
                <h3 className="font-bold text-amber-800 dark:text-amber-400">Low Stock Alerts ({lowStockItems.length})</h3>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {lowStockItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-lg border border-amber-100 dark:border-amber-900">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.product_name}</span>
                    <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded">Stock: {item.stock_quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overdue Credits */}
          {overdueCredits.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">💳</span>
                <h3 className="font-bold text-red-800 dark:text-red-400">Overdue Credits ({overdueCredits.length})</h3>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {overdueCredits.map(oc => (
                  <div key={oc.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg border border-red-100 dark:border-red-900">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{oc.customers?.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">Due: {oc.due_date}</span>
                      <span className="text-sm font-bold text-red-600">{currency}{oc.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Shortcuts */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 mt-2 border-b pb-2 dark:border-gray-700">Quick Shortcuts</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {shortcuts.map(s => (
              <Link key={s.href} href={s.href} className={`${s.bg} text-white rounded-xl p-5 flex flex-col items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-xl transition-all duration-200`}>
                <span className="text-2xl">{s.icon}</span>
                <span className="text-sm font-bold text-center">{s.label.split(' ')[1]}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </PageTemplate>
  )
}