'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

// default value to avoid null destructure
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

  // 1. LocalStorage එකෙන් ක්ෂණිකව Saved Theme එක Load කිරීම
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('app_settings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        setSettings(prev => ({ ...prev, ...parsed }))
      }
    } catch (e) {
      console.error('LocalStorage read error:', e)
    }
  }, [])

  // 2. Supabase branch_settings මගින් Load කිරීම
  const fetchSettings = async () => {
    if (!branch) return
    try {
      const { data } = await supabase
        .from('branch_settings')
        .select('*')
        .eq('branch_id', branch)
        .single()
      if (data) {
        setSettings(prev => ({ ...prev, ...data }))
        localStorage.setItem('app_settings', JSON.stringify(data))
      }
    } catch (err) {
      console.error('Fetch settings error:', err)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [branch])

  // 3. Local State & LocalStorage ක්ෂණිකව Update කිරීමේ Helper
  const updateSettings = (newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem('app_settings', JSON.stringify(updated))
      return updated
    })
  }

  // 4. <html> Tag එකට 'dark' Class එක යෙදීම
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
    <SettingsContext.Provider value={{ settings, refetchSettings: fetchSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)