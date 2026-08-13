'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

const DEFAULT_SETTINGS = {
  pos_enabled: true, inventory_enabled: true, customers_enabled: true,
  reports_enabled: true, staff_enabled: true, shop_enabled: true,
  users_enabled: true, bill_settings_enabled: true,
  tax_enabled: false, tax_rate: 0, currency_symbol: 'Rs. ',
  theme: 'light', date_format: 'DD/MM/YYYY',
  bill_header: 'Nishadi Motors', bill_footer: 'Thank you!',
  low_stock_global: 5, invite_code: '',
}

const SettingsContext = createContext({
  settings: DEFAULT_SETTINGS,
  refetchSettings: () => {},
  updateSettings: () => {},
})

export function SettingsProvider({ children }) {
  const auth = useAuth()
  const branch = auth?.branch
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme') || localStorage.getItem('app_theme')
      const savedSettings = localStorage.getItem('app_settings')
      let merged = {}
      if (savedSettings) merged = JSON.parse(savedSettings)
      if (savedTheme) merged.theme = savedTheme
      if (Object.keys(merged).length) setSettings(prev => ({ ...prev, ...merged }))
    } catch (e) {
      console.error('LocalStorage read error:', e)
    }
  }, [])

  const fetchSettings = async () => {
    if (!branch) return

    const { data, error } = await supabase
      .from('branch_settings')
      .select('*')
      .eq('branch_id', branch)
      .maybeSingle()

    if (error) {
      console.error('Fetch branch settings error:', error)
      return
    }

    if (data) {
      setSettings(prev => {
        // Theme remains a local preference; all other settings are branch-scoped.
        const localTheme = localStorage.getItem('theme')
        const updated = { ...prev, ...data, theme: localTheme || data.theme || prev.theme }
        localStorage.setItem('app_settings', JSON.stringify(updated))
        return updated
      })
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [branch])

  const updateSettings = (newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      if (newSettings.theme) localStorage.setItem('theme', newSettings.theme)
      localStorage.setItem('app_settings', JSON.stringify(updated))
      return updated
    })
  }

  useEffect(() => {
    const root = document.documentElement
    const currentTheme = settings.theme || 'light'
    if (currentTheme === 'dark') root.classList.add('dark')
    else if (currentTheme === 'light') root.classList.remove('dark')
    else if (currentTheme === 'system') root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
  }, [settings.theme])

  return (
    <SettingsContext.Provider value={{ settings, refetchSettings: fetchSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
