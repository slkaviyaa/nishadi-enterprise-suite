import { AuthProvider } from '../context/AuthContext'
import { SettingsProvider } from '../context/SettingsContext'
import { ToastProvider } from '../context/ToastContext'
import { Providers } from './ThemeProvider'
import './globals.css'

export const metadata = {
  title: "Nishadi POS",
  description: "Nishadi Enterprise Suite",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
        <Providers>
          <AuthProvider>
            <SettingsProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </SettingsProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}