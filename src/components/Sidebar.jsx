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

  // Common modules (visible to all roles if enabled)
  if (settings?.pos_enabled !== false) menu.push({ href: '/pos', label: 'POS', icon: <FiHome /> })
  if (settings?.inventory_enabled !== false) menu.push({ href: '/inventory', label: 'Inventory', icon: <FiPackage /> })
  if (settings?.customers_enabled !== false) menu.push({ href: '/customers', label: 'Customers', icon: <FiUsers /> })
  if (settings?.reports_enabled !== false) menu.push({ href: '/reports', label: 'Reports', icon: <FiBarChart2 /> })
  if (settings?.staff_enabled !== false) menu.push({ href: '/staff', label: 'Staff/Expenses', icon: <FiUserCheck /> })
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

    // 🔴 FIXED: Backup and Reset DB (Highlighted in Red)
    menu.push({ href: '/backup-restore', label: 'Backup & Reset DB', icon: <FiDatabase />, isDanger: true })

    // Settings at the very end
    menu.push({ href: '/settings', label: 'Module Settings', icon: <FiToggleLeft /> })
  }

  return (
    <div className="w-72 bg-[var(--sidebar)] text-[var(--sidebar-text)] flex flex-col shadow-xl h-screen">
      {/* Header with close button (mobile) */}
      <div className="p-4 text-xl font-bold border-b border-[var(--border)] flex items-center justify-between">
        <span>🚛 Nishadi Motors POS</span>
        <button
          className="lg:hidden p-1 rounded hover:bg-white dark:bg-gray-800/10"
          onClick={onClose}
        >
          <FiX size={20} />
        </button>
      </div>

      {/* Menu */}
      <ul className="menu flex-1 p-2 space-y-1 overflow-y-auto">
        <li>
          <Link
            href="/"
            className="flex items-center gap-3 py-2 transition-all duration-300 hover:bg-white dark:bg-gray-800/10 rounded-lg"
            onClick={onClose}
          >
            <FiGrid /> Dashboard
          </Link>
        </li>
        {menu.map((item, idx) => (
          <li
            key={item.href}
            className="animate-fadeInRight"
            style={{ animationDelay: `${0.1 + idx * 0.05}s` }}
          >
            <Link
              href={item.href}
              className={`flex items-center gap-3 py-2 transition-all duration-300 rounded-lg ${item.isDanger ? 'text-red-400 hover:bg-red-500/10' : 'hover:bg-white dark:bg-gray-800/10'}`}
              onClick={onClose}
            >
              {item.icon} {item.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)] space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="font-medium">{user?.display_name} ({user?.role})</span>
          <button onClick={logout} className="btn btn-ghost btn-sm">
            <FiLogOut />
          </button>
        </div>
        <div className="text-center text-xs opacity-60 dark:opacity-80 dark:text-gray-400">
          <div>{appVersion}</div>
          <div>
            Designed & Developed by{' '}
            <span className="font-semibold dark:text-gray-300">
              Ceylon Digi Solutions
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}