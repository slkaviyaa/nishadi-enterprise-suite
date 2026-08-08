'use client'
import { useState } from 'react'
import { useToast } from '../../context/ToastContext'

export default function BackupRestorePage() {
  const { showToast } = useToast()

  return (
    <div className="p-6 max-w-4xl mx-auto text-gray-900 dark:text-white">
      <h1 className="text-2xl font-bold mb-2">📦 Backup & Reset Database</h1>
      <p className="text-sm opacity-70 mb-6">Manage your database backups or perform a clean reset if necessary.</p>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="font-semibold text-lg text-red-500">⚠️ Danger Zone</h3>
        <p className="text-sm opacity-80">
          If you want to clear all deleted ghost items and reset your database completely, please use your Supabase Dashboard SQL Editor.
        </p>
        <button 
          onClick={() => showToast('Please use Supabase dashboard for full schema reset', 'info')}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition text-sm"
        >
          System Clean Guide
        </button>
      </div>
    </div>
  )
}