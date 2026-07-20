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
  })

  useEffect(() => {
    if (globalSettings) setLocal(globalSettings)
  }, [globalSettings])

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
    <div className="space-y-8 text-[var(--text)]">
      <h2 className="text-3xl font-bold">⚙️ Module & Business Settings</h2>

      {/* Feature Toggles */}
      <div className="bg-[var(--card)] shadow rounded-lg p-6 border border-[var(--border)]">
        <h3 className="text-xl font-semibold mb-4">Feature Modules</h3>
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
            <div key={item.key} className="flex items-center justify-between hover:bg-[var(--bg)] p-2 rounded transition-colors">
              <span className="text-lg font-medium">{item.label}</span>
              <button
                onClick={() => setLocal({ ...local, [item.key]: !local[item.key] })}
                className={`min-w-[80px] px-4 py-1 rounded-full text-sm font-bold transition-colors ${
                  local[item.key]
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-700'
                }`}
              >
                {local[item.key] ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tax Settings */}
      <div className="bg-[var(--card)] shadow rounded-lg p-6 border border-[var(--border)]">
        <h3 className="text-xl font-semibold mb-4">💰 Tax Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between hover:bg-[var(--bg)] p-2 rounded transition-colors">
            <span className="text-lg font-medium">Enable Tax</span>
            <button
              onClick={() => setLocal({ ...local, tax_enabled: !local.tax_enabled })}
              className={`min-w-[80px] px-4 py-1 rounded-full text-sm font-bold transition-colors ${
                local.tax_enabled ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-700'
              }`}
            >
              {local.tax_enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
            <input
              type="number"
              className="w-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded px-3 py-2"
              value={local.tax_rate}
              onChange={e => setLocal({ ...local, tax_rate: Number(e.target.value) })}
              min="0" max="100" step="0.5"
            />
          </div>
        </div>
      </div>

      {/* Currency & Theme */}
      <div className="bg-[var(--card)] shadow rounded-lg p-6 border border-[var(--border)]">
        <h3 className="text-xl font-semibold mb-4">🌍 Localization</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Currency Symbol</label>
            <input
              type="text"
              className="w-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded px-3 py-2"
              value={local.currency_symbol}
              onChange={e => setLocal({ ...local, currency_symbol: e.target.value })}
              placeholder="Rs. "
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <select
              className="w-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded px-3 py-2"
              value={local.theme}
              onChange={e => setLocal({ ...local, theme: e.target.value })}
            >
              <option value="light">☀️ Light</option>
              <option value="dark">🌙 Dark</option>
              <option value="system">💻 System</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date Format</label>
            <select
              className="w-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded px-3 py-2"
              value={local.date_format}
              onChange={e => setLocal({ ...local, date_format: e.target.value })}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bill Customization */}
      <div className="bg-[var(--card)] shadow rounded-lg p-6 border border-[var(--border)]">
        <h3 className="text-xl font-semibold mb-4">🧾 Bill / Receipt</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Header Text</label>
            <input
              type="text"
              className="w-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded px-3 py-2"
              value={local.bill_header}
              onChange={e => setLocal({ ...local, bill_header: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Footer Text</label>
            <input
              type="text"
              className="w-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded px-3 py-2"
              value={local.bill_footer}
              onChange={e => setLocal({ ...local, bill_footer: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Global Low‑Stock Alert</label>
            <input
              type="number"
              className="w-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded px-3 py-2"
              value={local.low_stock_global}
              onChange={e => setLocal({ ...local, low_stock_global: Number(e.target.value) })}
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="text-right">
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          💾 Save All Settings
        </button>
      </div>
    </div>
  )
}