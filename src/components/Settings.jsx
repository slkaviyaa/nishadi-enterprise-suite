'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

export default function Settings() {
  const { branch, user } = useAuth()
  const { settings: globalSettings, refetchSettings } = useSettings()
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

  const update = (key, value) => setLocal({ ...local, [key]: value })

  const handleSave = async () => {
    await supabase.from('branch_settings').upsert(
      { branch_id: branch, ...local },
      { onConflict: 'branch_id' }
    )
    alert('Settings saved!')
    refetchSettings()
  }

  if (user?.role !== 'owner') return <div className="alert alert-error">Access Denied</div>

  return (
    <div className="space-y-8 text-gray-900 dark:text-white dark:text-gray-100">
      <h2 className="text-3xl font-bold dark:text-white">⚙️ Module & Business Settings</h2>

      {/* Feature Toggles */}
      <div className="card bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 ">
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">Feature Modules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'pos_enabled', label: 'POS System' },
            { key: 'inventory_enabled', label: 'Inventory' },
            { key: 'customers_enabled', label: 'Customers' },
            { key: 'reports_enabled', label: 'Reports' },
            { key: 'staff_enabled', label: 'Staff/Expenses' },
            { key: 'shop_enabled', label: 'ShopFront' },
            { key: 'users_enabled', label: 'User Management' },
            { key: 'bill_settings_enabled', label: 'Bill Settings' },
          ].map(item => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-700 p-2 rounded">
              <span className="text-sm font-medium dark:text-gray-300">{item.label}</span>
              <button
                onClick={() => update(item.key, !local[item.key])}
                className={`min-w-[70px] px-3 py-1 rounded-full text-xs font-bold transition ${
                  local[item.key] ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                {local[item.key] ? 'ON' : 'OFF'}
              </button>
            </label>
          ))}
        </div>
      </div>

      {/* Tax Configuration */}
      <div className="card bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 ">
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">💰 Tax Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-700 p-2 rounded">
            <span className="text-sm font-medium dark:text-gray-300">Enable Tax</span>
            <button
              onClick={() => update('tax_enabled', !local.tax_enabled)}
              className={`min-w-[70px] px-3 py-1 rounded-full text-xs font-bold transition ${
                local.tax_enabled ? 'bg-purple-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {local.tax_enabled ? 'ON' : 'OFF'}
            </button>
          </label>
          <div className="form-control">
            <label className="label"><span className="label-text text-sm font-medium dark:text-gray-300">Tax Rate (%)</span></label>
            <input
              type="number"
              className="input input-bordered w-full bg-white dark:bg-gray-800 dark:bg-gray-700 text-gray-900 dark:text-white "
              value={local.tax_rate}
              onChange={e => update('tax_rate', Number(e.target.value))}
              min="0" max="100" step="0.5"
            />
          </div>
        </div>
      </div>

      {/* Localization */}
      <div className="card bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 ">
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">🌍 Localization</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label"><span className="label-text text-sm font-medium dark:text-gray-300">Currency Symbol</span></label>
            <input
              type="text"
              className="input input-bordered w-full bg-white dark:bg-gray-800 dark:bg-gray-700 text-gray-900 dark:text-white "
              value={local.currency_symbol}
              onChange={e => update('currency_symbol', e.target.value)}
              placeholder="Rs. "
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text text-sm font-medium dark:text-gray-300">Theme</span></label>
            <select
              className="select select-bordered w-full bg-white dark:bg-gray-800 dark:bg-gray-700 text-gray-900 dark:text-white "
              value={local.theme}
              onChange={e => update('theme', e.target.value)}
            >
              <option value="light">☀️ Light</option>
              <option value="dark">🌙 Dark</option>
              <option value="system">💻 System</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text text-sm font-medium dark:text-gray-300">Date Format</span></label>
            <select
              className="select select-bordered w-full bg-white dark:bg-gray-800 dark:bg-gray-700 text-gray-900 dark:text-white "
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
      <div className="card bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 ">
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">🧾 Bill / Receipt</h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="form-control">
            <label className="label"><span className="label-text text-sm font-medium dark:text-gray-300">Header Text</span></label>
            <input
              type="text"
              className="input input-bordered w-full bg-white dark:bg-gray-800 dark:bg-gray-700 text-gray-900 dark:text-white "
              value={local.bill_header}
              onChange={e => update('bill_header', e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text text-sm font-medium dark:text-gray-300">Footer Text</span></label>
            <input
              type="text"
              className="input input-bordered w-full bg-white dark:bg-gray-800 dark:bg-gray-700 text-gray-900 dark:text-white "
              value={local.bill_footer}
              onChange={e => update('bill_footer', e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text text-sm font-medium dark:text-gray-300">Global Low‑Stock Alert</span></label>
            <input
              type="number"
              className="input input-bordered w-full bg-white dark:bg-gray-800 dark:bg-gray-700 text-gray-900 dark:text-white "
              value={local.low_stock_global}
              onChange={e => update('low_stock_global', Number(e.target.value))}
              min="0"
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text text-sm font-medium dark:text-gray-300">🔑 Invite Code (for Signup)</span></label>
            <input
              type="text"
              className="input input-bordered w-full bg-white dark:bg-gray-800 dark:bg-gray-700 text-gray-900 dark:text-white "
              value={local.invite_code || ''}
              onChange={e => update('invite_code', e.target.value)}
              placeholder="Set a secret code"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="text-right">
        <button className="btn btn-primary btn-lg" onClick={handleSave}>
          💾 Save All Settings
        </button>
      </div>
    </div>
  )
}