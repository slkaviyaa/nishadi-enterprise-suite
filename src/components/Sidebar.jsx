'use client'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import {
  FiHome, FiPackage, FiUsers, FiBarChart2, FiUserCheck, FiShoppingCart,
  FiLogOut, FiUserPlus, FiSettings, FiGrid, FiToggleLeft,
  FiPercent, FiRepeat, FiFileText, FiDollarSign, FiTruck, FiCpu, FiX,
  FiBookOpen, FiBriefcase, FiList, FiBook, FiDatabase
} from 'react-icons/fi'

export default function Sidebar({ onClose }) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const router = useRouter()
  const appVersion = 'v1.0.0'

  const logout = async () => { await supabase.auth.signOut(); router.push('/') }

  const menu = []

  // Common modules
  if (settings?.pos_enabled !== false) menu.push({ href: '/pos', label: 'POS Terminal', icon: <FiHome /> })
  if (settings?.inventory_enabled !== false) menu.push({ href: '/inventory', label: 'Inventory', icon: <FiPackage /> })
  if (settings?.customers_enabled !== false) menu.push({ href: '/customers', label: 'Customers', icon: <FiUsers /> })
  if (settings?.reports_enabled !== false) menu.push({ href: '/reports', label: 'Reports', icon: <FiBarChart2 /> })
  if (settings?.staff_enabled !== false) menu.push({ href: '/staff', label: 'Staff & Expenses', icon: <FiUserCheck /> })
  if (settings?.shop_enabled !== false) menu.push({ href: '/shop', label: 'ShopFront', icon: <FiShoppingCart /> })

  // Owner-only modules
  if (user?.role === 'owner') {
    if (settings?.users_enabled !== false) menu.push({ href: '/users', label: 'Users', icon: <FiUserPlus /> })
    if (settings?.bill_settings_enabled !== false) menu.push({ href: '/bill-settings', label: 'Bill Settings', icon: <FiSettings /> })
    menu.push({ href: '/discounts', label: 'Discounts', icon: <FiPercent /> })
    menu.push({ href: '/stock-transfer', label: 'Stock Transfer', icon: <FiRepeat /> })
    menu.push({ href: '/quotations', label: 'Quotations', icon: <FiFileText /> })
    menu.push({ href: '/cash-ledger', label: 'Cash Ledger', icon: <FiDollarSign /> })
    menu.push({ href: '/purchase-orders', label: 'Purchase Orders', icon: <FiTruck /> })
    menu.push({ href: '/suppliers', label: 'Suppliers', icon: <FiUsers /> })
    menu.push({ href: '/devices', label: 'Devices', icon: <FiCpu /> })

    // Accounting sub-modules
    menu.push({ href: '/accounting/petty-cash', label: 'Petty Cash', icon: <FiDollarSign /> })
    menu.push({ href: '/accounting/bank-ledger', label: 'Bank Ledger', icon: <FiBookOpen /> })
    menu.push({ href: '/accounting/supplier-payments', label: 'Supplier Payments', icon: <FiTruck /> })
    menu.push({ href: '/accounting/cheque-management', label: 'Cheque Management', icon: <FiFileText /> })
    menu.push({ href: '/accounting/company-loans', label: 'Company Loans', icon: <FiBriefcase /> })
    menu.push({ href: '/accounting/chart-of-accounts', label: 'Chart of Accounts', icon: <FiList /> })
    menu.push({ href: '/accounting/journal', label: 'Journal Entries', icon: <FiBook /> })

    menu.push({ href: '/backup-restore', label: 'Backup & Reset DB', icon: <FiDatabase />, isDanger: true })
    menu.push({ href: '/settings', label: 'Module Settings', icon: <FiToggleLeft /> })
  }

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 flex flex-col">
      
      {/* Header */}
      <div className="p-5 text-xl font-extrabold border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-gray-900 dark:text-white shrink-0">
        <span className="flex items-center gap-2">🚛 Nishadi POS</span>
        <button
          className="lg:hidden p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          onClick={onClose}
        >
          <FiX size={20} />
        </button>
      </div>

      {/* Menu List */}
      <ul className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        <li>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-gray-800 dark:text-gray-300 dark:hover:text-white rounded-lg font-semibold"
            onClick={onClose}
          >
            <FiGrid size={18} /> Dashboard
          </Link>
        </li>
        {menu.map((item, idx) => (
          <li key={item.href} className="animate-fadeInRight" style={{ animationDelay: `${0.02 * idx}s` }}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all duration-200 rounded-lg font-semibold text-sm ${
                item.isDanger 
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-white'
              }`}
              onClick={onClose}
            >
              <span className="text-[18px] opacity-90">{item.icon}</span> 
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Footer Profile */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
        <div className="flex justify-between items-center mb-3 px-1">
          <div className="flex flex-col">
            <span className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-[150px]">
              {user?.display_name || 'User'}
            </span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              {user?.role || 'Staff'}
            </span>
          </div>
          <button 
            onClick={logout} 
            className="p-2.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 rounded-lg transition-colors" 
            title="Logout"
          >
            <FiLogOut size={18} />
          </button>
        </div>
        <div className="text-center text-[10px] text-gray-500 dark:text-gray-500 pt-3 border-t border-gray-200 dark:border-gray-800">
          <div>Version {appVersion}</div>
          <div className="mt-1">
            Designed & Developed by <br/>
            <span className="font-bold text-gray-700 dark:text-gray-400">Ceylon Digi Solutions</span>
          </div>
        </div>
      </div>

    </div>
  )
}