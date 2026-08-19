import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Nishadi Enterprise Suite',
  description: 'Enterprise ERP & POS System',
  manifest: '/manifest.json',
};

// 🟢 themeColor සහ Viewport configs වෙනම export එකක් විදිහට එකතු කළා
export const viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) { console.log('SW registered successfully'); },
                    function(err) { console.log('SW registration failed: ', err); }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}