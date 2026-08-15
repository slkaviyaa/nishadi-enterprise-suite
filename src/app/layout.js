import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Nishadi Enterprise Suite',
  description: 'Enterprise ERP & POS System',
  manifest: '/manifest.json', // 👈 PWA Manifest එක ලින්ක් කළා
  themeColor: '#2563eb',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        
        {/* 👈 Service Worker එක රෙජිස්ටර් කරන කෝඩ් එක */}
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