'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import Link from 'next/link'

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
    // Low stock items via database function
    supabase.rpc('get_low_stock_items', { bid: currentBranch })
      .then(({ data }) => setLowStockItems(data || []))
  }, [currentBranch])

  const currency = settings?.currency_symbol || 'Rs. '
  const shortcuts = [
    { href: '/pos', label: '🛒 POS', bg: 'bg-blue-600' },
    { href: '/inventory', label: '📦 Inventory', bg: 'bg-purple-600' },
    { href: '/customers', label: '👥 Customers', bg: 'bg-pink-600' },
    { href: '/reports', label: '📊 Reports', bg: 'bg-teal-600' },
    { href: '/staff', label: '👨‍💼 Staff', bg: 'bg-orange-500' },
    { href: '/shop', label: '🛍️ Shop', bg: 'bg-green-600' },
  ].filter(s => {
    if (s.href==='/pos' && settings?.pos_enabled===false) return false
    if (s.href==='/inventory' && settings?.inventory_enabled===false) return false
    if (s.href==='/customers' && settings?.customers_enabled===false) return false
    if (s.href==='/reports' && settings?.reports_enabled===false) return false
    if (s.href==='/staff' && settings?.staff_enabled===false) return false
    if (s.href==='/shop' && settings?.shop_enabled===false) return false
    return true
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white ">Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-600 text-white rounded-xl p-4 shadow hover:scale-105 transition"><div className="text-sm text-blue-100">Today's Sales</div><div className="text-xl sm:text-2xl font-bold">{currency}{stats.sales.toLocaleString()}</div></div>
        <div className="bg-purple-600 text-white rounded-xl p-4 shadow hover:scale-105 transition"><div className="text-sm text-purple-100">Customers</div><div className="text-xl sm:text-2xl font-bold">{stats.customers}</div></div>
        <div className="bg-pink-600 text-white rounded-xl p-4 shadow hover:scale-105 transition"><div className="text-sm text-pink-100">Products</div><div className="text-xl sm:text-2xl font-bold">{stats.products}</div></div>
        <div className="bg-orange-500 text-white rounded-xl p-4 shadow hover:scale-105 transition"><div className="text-sm text-orange-100">Expenses</div><div className="text-xl sm:text-2xl font-bold">{currency}{stats.expenses.toLocaleString()}</div></div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">⚠️ Low Stock Alert</h3>
          <div className="space-y-1">
            {lowStockItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item.product_name}</span>
                <span className="font-medium">Stock: {item.stock_quantity} (Min: {item.low_stock_threshold})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Credits */}
      {overdueCredits.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-700 dark:text-red-400">⚠️ Overdue Credits</h3>
          {overdueCredits.map(oc => <div key={oc.id} className="flex justify-between text-sm"><span>{oc.customers?.name}</span><span>{currency}{oc.amount}</span><span>Due: {oc.due_date}</span></div>)}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shortcuts.map(s => (
          <Link key={s.href} href={s.href} className={`${s.bg} text-white rounded-xl p-6 flex items-center justify-center text-lg font-bold hover:scale-105 hover:shadow-lg transition`}>{s.label}</Link>
        ))}
      </div>
    </div>
  )
}