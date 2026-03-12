export const dynamic = 'force-dynamic';

import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@superplus/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Issue Logger | SuperPlus',
  description: 'Report and track store issues for SuperPlus operations',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Issue Logger',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#E31837',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
