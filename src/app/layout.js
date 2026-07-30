import { AuthProvider } from '../context/AuthContext'
import { SettingsProvider } from '../context/SettingsContext'
import { ToastProvider } from '../context/ToastContext'
import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}