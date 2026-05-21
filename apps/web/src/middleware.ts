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

  if (pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL('/auth/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth.user?.mustChangePin && pathname !== '/auth/create-pin') {
    return NextResponse.redirect(new URL('/auth/create-pin', req.url));
  }

  if (pathname.startsWith('/admin')) {
    const role = req.auth.user?.role;
    if (role !== 'OWNER' && role !== 'MANAGER') {
      return new NextResponse('Access denied', { status: 403 });
    }
  }

  const host = req.headers.get('host') || '';
  const subdomain = host.split('.')[0];

  if (subdomain && subdomain in SUBDOMAIN_MAP && !host.includes('localhost')) {
    const prefix = SUBDOMAIN_MAP[subdomain];

    if (subdomain === 'admin') {
      const role = req.auth.user?.role;
      if (role !== 'OWNER' && role !== 'MANAGER') {
        return new NextResponse('Access denied', { status: 403 });
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
