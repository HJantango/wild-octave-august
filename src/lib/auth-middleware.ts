import { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'auth-session';

/**
 * Lightweight authentication check for middleware (Edge Runtime compatible)
 * Only checks if the auth cookie exists - full validation happens in API routes
 */
export function isAuthenticatedMiddleware(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME);
  return !!sessionCookie?.value;
}
