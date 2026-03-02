import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse } from '@/lib/api-utils';
import { verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return createSuccessResponse({
        error: 'Email and password required',
        step: 'validation',
      });
    }

    const result: any = {
      steps: [],
      email: email,
      timestamp: new Date().toISOString(),
    };

    // Step 1: Check if user exists
    result.steps.push('🔍 Looking up user in database...');
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        password: true, // We need this for verification
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      result.steps.push('❌ User not found in database');
      result.userFound = false;
      return createSuccessResponse(result);
    }

    result.steps.push('✅ User found in database');
    result.userFound = true;
    result.userInfo = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0,
      passwordStartsWith: user.password ? user.password.substring(0, 10) + '...' : 'N/A',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Step 2: Check if user is active
    if (!user.isActive) {
      result.steps.push('❌ User account is inactive');
      result.userActive = false;
      return createSuccessResponse(result);
    }

    result.steps.push('✅ User account is active');
    result.userActive = true;

    // Step 3: Check password verification
    result.steps.push('🔐 Verifying password...');
    
    try {
      const isValidPassword = await verifyPassword(password, user.password);
      
      if (!isValidPassword) {
        result.steps.push('❌ Password verification failed');
        result.passwordValid = false;
        result.passwordInfo = {
          providedPassword: password,
          providedPasswordLength: password.length,
          storedHashLength: user.password.length,
          hashStartsWith: user.password.substring(0, 10) + '...',
        };
      } else {
        result.steps.push('✅ Password verification successful');
        result.passwordValid = true;
      }
    } catch (passwordError: any) {
      result.steps.push('❌ Password verification threw error: ' + passwordError.message);
      result.passwordValid = false;
      result.passwordError = passwordError.message;
    }

    // Step 4: Overall assessment
    result.overallAssessment = user && user.isActive && result.passwordValid
      ? '✅ All checks passed - login should work'
      : '❌ Authentication would fail';

    return createSuccessResponse(result);

  } catch (error: any) {
    console.error('Auth debug error:', error);
    return createSuccessResponse({
      error: error.message,
      stack: error.stack,
      step: 'exception',
    });
  }
}

export const dynamic = 'force-dynamic';