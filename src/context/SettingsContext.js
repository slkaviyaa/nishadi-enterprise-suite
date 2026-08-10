'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

// Default values
const SettingsContext = createContext({
  settings: {
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
  },
  refetchSettings: () => {},
  updateSettings: () => {},
})

export function SettingsProvider({ children }) {
  const auth = useAuth()
  const branch = auth?.branch

  const [settings, setSettings] = useState({
    pos_enabled: true, inventory_enabled: true, customers_enabled: true,
    reports_enabled: true, staff_enabled: true, shop_enabled: true,
    users_enabled: true, bill_settings_enabled: true,
    tax_enabled: false, tax_rate: 0, currency_symbol: 'Rs. ',
    theme: 'light', date_format: 'DD/MM/YYYY',
    bill_header: 'Nishadi Motors', bill_footer: 'Thank you!',
    low_stock_global: 5, invite_code: '',
  })

  // 1. LocalStorage එකෙන් පරිශීලකයාගේ explicit theme එක මුලින්ම Read කිරීම
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme') || localStorage.getItem('app_theme')
      const savedSettings = localStorage.getItem('app_settings')
      let merged = {}
      if (savedSettings) {
        merged = JSON.parse(savedSettings)
      }
      if (savedTheme) {
        merged.theme = savedTheme
      }
      if (Object.keys(merged).length > 0) {
        setSettings(prev => ({ ...prev, ...merged }))
      }
    } catch (e) {
      console.error('LocalStorage read error:', e)
    }
  }, [])

  // 2. Fetch from Supabase branch_settings
  const fetchSettings = async () => {
    if (!branch) return
    try {
      const { data } = await supabase
        .from('branch_settings')
        .select('*')
        .eq('branch_id', branch)
        .single()
      if (data) {
        setSettings(prev => {
          const localTheme = localStorage.getItem('theme')
          const finalTheme = localTheme || data.theme || prev.theme
          const updated = { ...prev, ...data, theme: finalTheme }
          localStorage.setItem('app_settings', JSON.stringify(updated))
          return updated
        })
      }
    } catch (err) {
      console.error('Fetch settings error:', err)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [branch])

  // 3. Update Settings & Save Explicit Local Theme
  const updateSettings = (newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      if (newSettings.theme) {
        localStorage.setItem('theme', newSettings.theme)
      }
      localStorage.setItem('app_settings', JSON.stringify(updated))
      return updated
    })
  }

  // 4. Apply Theme to <html> (Explicit user choice ALWAYS overrides System OS mode)
  useEffect(() => {
    const root = document.documentElement
    const currentTheme = settings.theme || 'light'

    if (currentTheme === 'dark') {
      root.classList.add('dark')
    } else if (currentTheme === 'light') {
      root.classList.remove('dark')
    } else if (currentTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [settings.theme])

  return (
    <SettingsContext.Provider value={{ settings, refetchSettings: fetchSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)