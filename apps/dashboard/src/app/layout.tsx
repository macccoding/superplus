export const dynamic = 'force-dynamic';

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@superplus/auth';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'SuperPlus Dashboard',
  description: 'Management dashboard for SuperPlus store operations',
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
    <html lang="en" className={inter.variable}>
      <body className="font-body antialiased bg-background text-text-primary">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
