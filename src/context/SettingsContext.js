'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const { branch } = useAuth()
  const [settings, setSettings] = useState({
    pos_enabled: true, inventory_enabled: true, customers_enabled: true,
    reports_enabled: true, staff_enabled: true, shop_enabled: true,
    users_enabled: true, bill_settings_enabled: true,
    tax_enabled: false, tax_rate: 0, currency_symbol: 'Rs. ',
    theme: 'light', date_format: 'DD/MM/YYYY',
    bill_header: 'Nishadi Motors', bill_footer: 'Thank you!',
    low_stock_global: 5,
  })

  const fetchSettings = async () => {
    if (!branch) return
    const { data } = await supabase
      .from('branch_settings')
      .select('*')
      .eq('branch_id', branch)
      .single()
    if (data) setSettings(prev => ({ ...prev, ...data }))
  }

  useEffect(() => { fetchSettings() }, [branch])

  // Theme apply
  useEffect(() => {
    const root = document.documentElement
    const applyTheme = (theme) => {
      if (theme === 'dark') {
        root.classList.add('dark')
      } else if (theme === 'light') {
        root.classList.remove('dark')
      } else if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
      }
    }
    applyTheme(settings.theme)

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const listener = () => applyTheme('system')
      mediaQuery.addEventListener('change', listener)
      return () => mediaQuery.removeEventListener('change', listener)
    }
  }, [settings.theme])

  return (
    <SettingsContext.Provider value={{ settings, refetchSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)