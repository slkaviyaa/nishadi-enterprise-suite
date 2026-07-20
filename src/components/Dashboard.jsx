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

  useEffect(() => {
    if (!currentBranch) return
    supabase.from('orders').select('total').eq('branch_id', currentBranch).eq('status','completed')
      .gte('created_at', new Date().toISOString().split('T')[0])
      .then(({ data }) => { if (data) setStats(prev => ({ ...prev, sales: data.reduce((s,o)=>s+o.total,0) })) })
    supabase.from('customers').select('*', { count:'exact', head:true }).eq('branch_id', currentBranch)
      .then(({ count }) => setStats(prev => ({ ...prev, customers: count||0 })))
    supabase.from('branch_products').select('*', { count:'exact', head:true }).eq('branch_id', currentBranch)
      .then(({ count }) => setStats(prev => ({ ...prev, products: count||0 })))
    supabase.from('expenses').select('amount').eq('branch_id', currentBranch)
      .gte('created_at', new Date().toISOString().split('T')[0])
      .then(({ data }) => { if (data) setStats(prev => ({ ...prev, expenses: data.reduce((s,e)=>s+e.amount,0) })) })
    supabase.from('credit_transactions').select('id, amount, due_date, customers(name, phone)')
      .eq('branch_id', currentBranch).eq('type', 'purchase')
      .lt('due_date', new Date().toISOString().split('T')[0])
      .order('due_date').then(({ data }) => setOverdueCredits(data || []))
  }, [currentBranch])

  const currency = settings?.currency_symbol || 'Rs. '

  const shortcuts = []
  if (settings?.pos_enabled !== false) shortcuts.push({ href: '/pos', label: '🛒 POS System', color: 'bg-primary' })
  if (settings?.inventory_enabled !== false) shortcuts.push({ href: '/inventory', label: '📦 Inventory', color: 'bg-secondary' })
  if (settings?.customers_enabled !== false) shortcuts.push({ href: '/customers', label: '👥 Customers', color: 'bg-accent' })
  if (settings?.reports_enabled !== false) shortcuts.push({ href: '/reports', label: '📊 Reports', color: 'bg-info' })
  if (settings?.staff_enabled !== false) shortcuts.push({ href: '/staff', label: '👨‍💼 Staff/Expenses', color: 'bg-warning' })
  if (settings?.shop_enabled !== false) shortcuts.push({ href: '/shop', label: '🛍️ ShopFront', color: 'bg-success' })

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100 animate-fadeIn">
      <h1 className="text-3xl font-bold dark:text-white">Dashboard</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat bg-blue-600 text-white rounded-box p-4 shadow-lg transition-all duration-300 hover:scale-105">
          <div className="stat-title text-white/80">Today's Sales</div>
          <div className="stat-value text-2xl">{currency}{stats.sales.toLocaleString()}</div>
        </div>
        <div className="stat bg-purple-600 text-white rounded-box p-4 shadow-lg transition-all duration-300 hover:scale-105">
          <div className="stat-title text-white/80">Customers</div>
          <div className="stat-value text-2xl">{stats.customers}</div>
        </div>
        <div className="stat bg-pink-600 text-white rounded-box p-4 shadow-lg transition-all duration-300 hover:scale-105">
          <div className="stat-title text-white/80">Products</div>
          <div className="stat-value text-2xl">{stats.products}</div>
        </div>
        <div className="stat bg-orange-500 text-white rounded-box p-4 shadow-lg transition-all duration-300 hover:scale-105">
          <div className="stat-title text-white/80">Today's Expenses</div>
          <div className="stat-value text-2xl">{currency}{stats.expenses.toLocaleString()}</div>
        </div>
      </div>

      {overdueCredits.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 animate-fadeInUp">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">⚠️ Overdue Credits</h3>
          <div className="space-y-2">
            {overdueCredits.map(oc => (
              <div key={oc.id} className="flex justify-between text-sm text-red-800 dark:text-red-300">
                <span>{oc.customers?.name} ({oc.customers?.phone})</span>
                <span className="font-bold">{currency}{oc.amount}</span>
                <span className="text-xs opacity-70 dark:opacity-90">Due: {oc.due_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shortcuts.map(s => (
          <Link key={s.href} href={s.href} className={`btn btn-lg h-24 text-xl ${s.color} text-white transition-all duration-300 hover:scale-105 hover:shadow-lg`}>
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  )
}