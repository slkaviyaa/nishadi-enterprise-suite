import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Nishadi Enterprise Suite',
  description: 'Enterprise ERP & POS System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}