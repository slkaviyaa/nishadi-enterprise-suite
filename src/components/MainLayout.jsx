'use client'
import { useState } from 'react'
import Sidebar from './Sidebar'
import { FiMenu } from 'react-icons/fi'

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-base-200 relative">
      {/* Sidebar – overlay on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-72 bg-[var(--sidebar)] text-[var(--sidebar-text)]`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Overlay when sidebar open on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 overflow-auto w-full pt-12 sm:pt-0">
        {/* Hamburger button – ONLY when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow"
            title="Menu"
          >
            <FiMenu size={20} />
          </button>
        )}
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  )
}