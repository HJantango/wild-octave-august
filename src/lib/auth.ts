import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'auth-token';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'dev-access-token-change-in-production';

export interface AuthSession {
  isAuthenticated: boolean;
  token?: string;
}

export function validateAccessToken(token: string): boolean {
  return token === ACCESS_TOKEN;
}

export async function getSession(): Promise<AuthSession> {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get(AUTH_COOKIE_NAME);

    if (!authToken || !validateAccessToken(authToken.value)) {
      return { isAuthenticated: false };
    }

    return {
      isAuthenticated: true,
      token: authToken.value,
    };
  } catch {
    return { isAuthenticated: false };
  }
}

export async function createAuthSession(token: string): Promise<boolean> {
  if (!validateAccessToken(token)) {
    return false;
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    return true;
  } catch {
    return false;
  }
}

export async function destroyAuthSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
  } catch {
    // Ignore errors when destroying session
  }
}

export function getAuthTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
  return authCookie?.value || null;
}

export function isAuthenticated(request: NextRequest): boolean {
  const token = getAuthTokenFromRequest(request);
  return token ? validateAccessToken(token) : false;
}