export const dynamic = 'force-dynamic';

import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@superplus/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Markdown Tool | SuperPlus',
  description: 'Create and manage price markdowns for SuperPlus store products',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Markdown Tool',
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
