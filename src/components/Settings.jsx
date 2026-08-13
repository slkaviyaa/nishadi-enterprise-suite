'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import PageTemplate from './PageTemplate' // 👈 PageTemplate Import කර ඇත

export default function Settings() {
  const { branch, user } = useAuth()
  const { settings: globalSettings, refetchSettings } = useSettings()
  const [loading, setLoading] = useState(false)
  const [local, setLocal] = useState({
    pos_enabled: true,
    inventory_enabled: true,
    customers_enabled: true,
    reports_enabled: true,
    staff_enabled: true,
    shop_enabled: true,
    users_enabled: true,
    bill_settings_enabled: true,
    tax_enabled: false,
    tax_rate: 0,
    currency_symbol: 'Rs. ',
    theme: 'light',
    date_format: 'DD/MM/YYYY',
    bill_header: 'Nishadi Motors',
    bill_footer: 'Thank you!',
    low_stock_global: 5,
    invite_code: '',
  })

  useEffect(() => {
    if (globalSettings) setLocal(prev => ({ ...prev, ...globalSettings }))
  }, [globalSettings])

  // Instant Theme Toggle
  const update = (key, value) => {
    const updated = { ...local, [key]: value }
    setLocal(updated)

    if (key === 'theme') {
      localStorage.setItem('theme', value)
      const root = document.documentElement
      if (value === 'dark') root.classList.add('dark')
      else if (value === 'light') root.classList.remove('dark')
      else if (value === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
      }
    }
  }

  const handleSave = async () => {
    setLoading(true)

    // 1. Instantly save to LocalStorage
    if (local.theme) {
      localStorage.setItem('theme', local.theme)
      const root = document.documentElement
      if (local.theme === 'dark') root.classList.add('dark')
      else if (local.theme === 'light') root.classList.remove('dark')
    }
    localStorage.setItem('app_settings', JSON.stringify(local))

    // 2. Save to Supabase
    if (branch) {
      const { error } = await supabase.from('branch_settings').upsert(
        { branch_id: branch, ...local },
        { onConflict: 'branch_id' }
      )
      if (error) {
        console.error('Settings save error:', error)
      }
    }

    alert('Settings saved successfully!')
    if (refetchSettings) refetchSettings()
    setLoading(false)
  }

  if (user?.role !== 'owner') return <div className="p-6 text-red-500 font-bold">Access Denied</div>

  // Metric Calculation
  const activeModulesCount = [
    local.pos_enabled, local.inventory_enabled, local.customers_enabled,
    local.reports_enabled, local.staff_enabled, local.shop_enabled,
    local.users_enabled, local.bill_settings_enabled
  ].filter(Boolean).length

  const metrics = [
    { label: 'Active Modules', value: `${activeModulesCount} / 8`, icon: '🧩' },
    { label: 'Tax Status', value: local.tax_enabled ? `${local.tax_rate}% ON` : 'OFF', icon: '💰' },
    { label: 'Current Theme', value: local.theme === 'dark' ? '🌙 Dark' : local.theme === 'system' ? '💻 System' : '☀️ Light', icon: '🎨' },
    { label: 'Low Stock Alert', value: `${local.low_stock_global} Items`, icon: '⚠️' },
  ]

  const actions = (
    <button
      onClick={handleSave}
      disabled={loading}
      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
    >
      {loading ? 'Saving...' : '💾 Save All Settings'}
    </button>
  )

  return (
    <PageTemplate
      title="⚙️ Module & Business Settings"
      subtitle="Configure system modules, tax rules, localization, theme & receipt options"
      metrics={metrics}
      actions={actions}
    >
      <div className="space-y-6">
        {/* Feature Modules */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-700">
            🧩 Feature Modules (මොඩියුල පාලනය)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'pos_enabled', label: 'POS System' },
              { key: 'inventory_enabled', label: 'Inventory Management' },
              { key: 'customers_enabled', label: 'Customers CRM' },
              { key: 'reports_enabled', label: 'Reports & Analytics' },
              { key: 'staff_enabled', label: 'Staff & Expenses' },
              { key: 'shop_enabled', label: 'ShopFront' },
              { key: 'users_enabled', label: 'User Roles & Permissions' },
              { key: 'bill_settings_enabled', label: 'Bill Settings' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                <button
                  type="button"
                  onClick={() => update(item.key, !local[item.key])}
                  className={`min-w-[70px] px-3 py-1 rounded-full text-xs font-bold transition shadow-sm ${
                    local[item.key] ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {local[item.key] ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tax Configuration */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-700">
            💰 Tax Configuration (බදු සැකසුම්)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Tax on Checkout</span>
              <button
                type="button"
                onClick={() => update('tax_enabled', !local.tax_enabled)}
                className={`min-w-[70px] px-3 py-1 rounded-full text-xs font-bold transition shadow-sm ${
                  local.tax_enabled ? 'bg-purple-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                {local.tax_enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                value={local.tax_rate}
                onChange={e => update('tax_rate', Number(e.target.value))}
                min="0" max="100" step="0.5"
              />
            </div>
          </div>
        </div>

        {/* Localization */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-700">
            🌍 Localization & Theme (ප්‍රාදේශීය සහ වර්ණ සැකසුම්)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Currency Symbol</label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                value={local.currency_symbol}
                onChange={e => update('currency_symbol', e.target.value)}
                placeholder="Rs. "
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Theme (වර්ණ තේමාව)</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                value={local.theme}
                onChange={e => update('theme', e.target.value)}
              >
                <option value="light">☀️ Light</option>
                <option value="dark">🌙 Dark</option>
                <option value="system">💻 System</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Date Format</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                value={local.date_format}
                onChange={e => update('date_format', e.target.value)}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bill / Receipt */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-700">
            🧾 Bill / Receipt Settings (බිල්පත් සැකසුම්)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Header Text</label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                value={local.bill_header}
                onChange={e => update('bill_header', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Footer Text</label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                value={local.bill_footer}
                onChange={e => update('bill_footer', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Global Low‑Stock Alert</label>
              <input
                type="number"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                value={local.low_stock_global}
                onChange={e => update('low_stock_global', Number(e.target.value))}
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">🔑 Invite Code (for Signup)</label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                value={local.invite_code || ''}
                onChange={e => update('invite_code', e.target.value)}
                placeholder="Set a secret code"
              />
            </div>
          </div>
        </div>
      </div>
    </PageTemplate>
  )
}