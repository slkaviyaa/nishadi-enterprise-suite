'use client'
import { useState } from 'react'
import Sidebar from './Sidebar'
import { FiMenu, FiX } from 'react-icons/fi'

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen bg-base-200">
      {/* Sidebar with slide animation */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          sidebarOpen ? 'w-72' : 'w-0'
        }`}
      >
        <Sidebar />
      </div>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="btn btn-ghost btn-sm m-2 z-50"
          title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
        </button>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}