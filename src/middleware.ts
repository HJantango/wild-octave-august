import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login'];

// API routes that require authentication
const protectedApiRoutes = [
  '/api/invoices',
  '/api/sales',
  '/api/items',
  '/api/settings',
  '/api/roster',
];

// Page routes that require authentication
const protectedPageRoutes = [
  '/',
  '/sales',
  '/invoices',
  '/items',
  '/settings',
  '/rectification',
];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
}

function isProtectedRoute(pathname: string): boolean {
  const isProtectedApi = protectedApiRoutes.some(route => 
    pathname.startsWith(route)
  );
  const isProtectedPage = protectedPageRoutes.some(route => 
    pathname === route || (route !== '/' && pathname.startsWith(route + '/'))
  );
  
  return isProtectedApi || isProtectedPage;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') // Skip files with extensions
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  if (isProtectedRoute(pathname)) {
    const authenticated = isAuthenticated(request);

    if (!authenticated) {
      // For API routes, return 401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }

      // For page routes, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};