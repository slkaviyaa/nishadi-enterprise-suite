import './globals.css'
import { AuthProvider } from '../context/AuthContext'
import { SettingsProvider } from '../context/SettingsContext'
import { ToastProvider } from '../context/ToastContext'

export const metadata = { title: 'Nishadi Enterprise Suite' }

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === 'production' && (
          <script dangerouslySetInnerHTML={{ __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js') }) }` }} />
        )}
      </head>
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