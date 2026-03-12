export const dynamic = 'force-dynamic';

import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@superplus/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Daily Specials — SuperPlus',
  description: 'View today\'s produce prices, promotions, and markdowns.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#E31837',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
