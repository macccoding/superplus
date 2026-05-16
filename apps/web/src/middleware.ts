import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/server/auth';

const SUBDOMAIN_MAP: Record<string, string> = {
  hub: '/hub',
  admin: '/admin',
  tools: '/tools',
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (pathname === '/login') {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  const host = req.headers.get('host') || '';
  const subdomain = host.split('.')[0];

  if (subdomain && subdomain in SUBDOMAIN_MAP && !host.includes('localhost')) {
    const prefix = SUBDOMAIN_MAP[subdomain];

    if (subdomain === 'admin') {
      const role = req.auth.user?.role;
      if (role !== 'OWNER' && role !== 'MANAGER') {
        return NextResponse.redirect(new URL('/hub', req.url));
      }
    }

    if (!pathname.startsWith(prefix)) {
      const url = req.nextUrl.clone();
      url.pathname = `${prefix}${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/hub', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
