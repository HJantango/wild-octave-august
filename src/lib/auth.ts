import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/api-utils';

const AUTH_COOKIE_NAME = 'auth-session';
const SALT_ROUNDS = 10;

export interface AuthSession {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  role?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function authenticateUser(email: string, password: string): Promise<{ success: boolean; userId?: string; email?: string; role?: string; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Account is disabled' };
    }

    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      return { success: false, error: 'Invalid email or password' };
    }

    return {
      success: true,
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

export async function getSession(): Promise<AuthSession> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME);

    if (!sessionCookie) {
      return { isAuthenticated: false };
    }

    // Parse the session data (userId)
    const userId = sessionCookie.value;

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return { isAuthenticated: false };
    }

    return {
      isAuthenticated: true,
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error('Get session error:', error);
    return { isAuthenticated: false };
  }
}

export async function createAuthSession(userId: string, email: string): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    return true;
  } catch (error) {
    console.error('Create session error:', error);
    return false;
  }
}

export async function destroyAuthSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
  } catch (error) {
    console.error('Destroy session error:', error);
  }
}

export function getUserIdFromRequest(request: NextRequest): string | null {
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME);
  return sessionCookie?.value || null;
}

export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return false;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });

    return user?.isActive ?? false;
  } catch (error) {
    console.error('isAuthenticated error:', error);
    return false;
  }
}

// Helper to create a new user (for seeding/admin purposes)
export async function createUser(email: string, password: string, name?: string, role: 'ADMIN' | 'USER' = 'USER'): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name,
        role,
      },
    });

    return { success: true, userId: user.id };
  } catch (error: any) {
    console.error('Create user error:', error);
    if (error.code === 'P2002') {
      return { success: false, error: 'Email already exists' };
    }
    return { success: false, error: 'Failed to create user' };
  }
}
