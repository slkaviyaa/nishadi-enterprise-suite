'use client'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import {
  FiHome, FiPackage, FiUsers, FiBarChart2, FiUserCheck, FiShoppingCart,
  FiLogOut, FiUserPlus, FiSettings, FiGrid, FiToggleLeft
} from 'react-icons/fi'

export default function Sidebar() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const router = useRouter()
  const appVersion = 'v1.0.0'

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const menu = []
  if (settings.pos_enabled !== false) menu.push({ href: '/pos', label: 'POS', icon: <FiHome /> })
  if (settings.inventory_enabled !== false) menu.push({ href: '/inventory', label: 'Inventory', icon: <FiPackage /> })
  if (settings.customers_enabled !== false) menu.push({ href: '/customers', label: 'Customers', icon: <FiUsers /> })
  if (settings.reports_enabled !== false) menu.push({ href: '/reports', label: 'Reports', icon: <FiBarChart2 /> })
  if (settings.staff_enabled !== false) menu.push({ href: '/staff', label: 'Staff/Expenses', icon: <FiUserCheck /> })
  if (settings.shop_enabled !== false) menu.push({ href: '/shop', label: 'ShopFront', icon: <FiShoppingCart /> })
  if (user?.role === 'owner') {
    if (settings.users_enabled !== false) menu.push({ href: '/users', label: 'Users', icon: <FiUserPlus /> })
    if (settings.bill_settings_enabled !== false) menu.push({ href: '/bill-settings', label: 'Bill Settings', icon: <FiSettings /> })
    menu.push({ href: '/settings', label: 'Module Settings', icon: <FiToggleLeft /> })
  }

  return (
    <div className="w-72 bg-[var(--sidebar)] text-[var(--sidebar-text)] flex flex-col shadow-xl">
      <div className="p-4 text-xl font-bold border-b border-[var(--border)] text-center">
        🚛 Nishadi Motors POS
      </div>
      <ul className="menu flex-1 p-2 space-y-1">
        <li>
          <Link href="/" className="flex items-center gap-3 py-2 transition-all duration-300 hover:bg-white/10 rounded-lg">
            <FiGrid /> Dashboard
          </Link>
        </li>
        {menu.map((item, idx) => (
          <li key={item.href} className="animate-fadeInRight" style={{ animationDelay: `${0.1 + idx * 0.05}s` }}>
            <Link href={item.href} className="flex items-center gap-3 py-2 transition-all duration-300 hover:bg-white/10 rounded-lg">
              {item.icon} {item.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)] space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="font-medium">{user?.display_name} ({user?.role})</span>
          <button onClick={logout} className="btn btn-ghost btn-sm"><FiLogOut /></button>
        </div>
        <div className="text-center text-xs opacity-60 space-y-1">
          <div>{appVersion}</div>
          <div>Designed & Developed by <span className="font-semibold">Ceylon Digi Solutions</span></div>
        </div>
      </div>
    </div>
  )
}