import { NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { PrismaClient } from '@prisma/client';

// Global singleton pattern for Prisma client to prevent connection leaks
declare global {
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  // Skip during build when DATABASE_URL isn't available
  if (!process.env.DATABASE_URL) {
    return null as unknown as PrismaClient;
  }
  
  // 🛡️ SAFEGUARD: Prevent connecting to production database in development mode
  const isDevMode = process.env.NODE_ENV === 'development';
  const isProdDb = process.env.DATABASE_URL?.includes('railway') || 
                   process.env.DATABASE_URL?.includes('proxy.rlwy.net');
  
  if (isDevMode && isProdDb) {
    console.error('\n🚨 ═══════════════════════════════════════════════════════════════');
    console.error('🚨 DANGER: Attempting to connect to PRODUCTION database in dev mode!');
    console.error('🚨 ═══════════════════════════════════════════════════════════════');
    console.error('🚨 Your .env.local should use the LOCAL database URL:');
    console.error('🚨 DATABASE_URL="postgresql://localdev:localdev123@localhost:5433/wildoctave_dev"');
    console.error('🚨 ═══════════════════════════════════════════════════════════════\n');
    throw new Error('Production database connection blocked in development mode. Check your .env.local');
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

// Lazy initialization - create client on first use at runtime
let _prisma: PrismaClient | null = null;

const getPrisma = (): PrismaClient => {
  // Return cached instance
  if (_prisma) return _prisma;
  if (globalThis.__prisma) {
    _prisma = globalThis.__prisma;
    return _prisma;
  }
  
  // Create new instance at runtime
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set at runtime');
    throw new Error('Database not available');
  }
  
  _prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: ['error'],
  });
  
  globalThis.__prisma = _prisma;
  return _prisma;
};

// Export getter - all code should use prisma.xxx which triggers getPrisma()
export const prisma = {
  get item() { return getPrisma().item; },
  get vendor() { return getPrisma().vendor; },
  get invoice() { return getPrisma().invoice; },
  get invoiceLineItem() { return getPrisma().invoiceLineItem; },
  get itemPriceHistory() { return getPrisma().itemPriceHistory; },
  get salesAggregate() { return getPrisma().salesAggregate; },
  get inventoryItem() { return getPrisma().inventoryItem; },
  get purchaseOrder() { return getPrisma().purchaseOrder; },
  get purchaseOrderLineItem() { return getPrisma().purchaseOrderLineItem; },
  get wastageRecord() { return getPrisma().wastageRecord; },
  get discountRecord() { return getPrisma().discountRecord; },
  get productDecision() { return getPrisma().productDecision; },
  get rosterStaff() { return getPrisma().rosterStaff; },
  get rosterShift() { return getPrisma().rosterShift; },
  get weeklyRoster() { return getPrisma().weeklyRoster; },
  get cafeLabelTemplate() { return getPrisma().cafeLabelTemplate; },
  get publicHoliday() { return getPrisma().publicHoliday; },
  get shopOpsTask() { return getPrisma().shopOpsTask; },
  get shopOpsSchedule() { return getPrisma().shopOpsSchedule; },
  get shopOpsCompletion() { return getPrisma().shopOpsCompletion; },
  $queryRaw: (...args: any[]) => getPrisma().$queryRaw(...args),
  $executeRaw: (...args: any[]) => getPrisma().$executeRaw(...args),
  $transaction: (...args: any[]) => (getPrisma().$transaction as any)(...args),
  $disconnect: () => getPrisma().$disconnect(),
} as unknown as PrismaClient;

// Gracefully disconnect Prisma on process exit
const shutdown = async () => {
  if (_prisma) {
    await _prisma.$disconnect();
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

// Error response helper
export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status }
  );
}

// Success response helper
export function createSuccessResponse(
  data: any,
  message?: string,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      data,
      success: true,
      ...(message && { message }),
    },
    { status }
  );
}

// Validation helper
export function validateRequest<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: NextResponse } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.errors
        ),
      };
    }
    return {
      success: false,
      error: createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid request data',
        400
      ),
    };
  }
}

// File upload helper
export async function handleFileUpload(
  request: NextRequest,
  allowedMimeTypes: string[] = ['application/pdf'],
  maxSize: number = 50 * 1024 * 1024 // 50MB
): Promise<{ success: true; buffer: Buffer; filename: string } | { success: false; error: NextResponse }> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return {
        success: false,
        error: createErrorResponse('FILE_MISSING', 'No file provided', 400),
      };
    }

    if (file.size > maxSize) {
      return {
        success: false,
        error: createErrorResponse(
          'FILE_TOO_LARGE',
          `File size exceeds ${maxSize / 1024 / 1024}MB limit`,
          400
        ),
      };
    }

    if (!allowedMimeTypes.includes(file.type)) {
      return {
        success: false,
        error: createErrorResponse(
          'INVALID_FILE_TYPE',
          `File type ${file.type} not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
          400
        ),
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    return {
      success: true,
      buffer,
      filename: file.name,
    };
  } catch (error) {
    return {
      success: false,
      error: createErrorResponse(
        'FILE_UPLOAD_ERROR',
        'Failed to process uploaded file',
        500
      ),
    };
  }
}

// Pagination helper
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}

// Database transaction helper
export async function withTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(callback);
}

// Request method handler
export function createMethodHandler(handlers: {
  GET?: (request: NextRequest, context?: any) => Promise<NextResponse>;
  POST?: (request: NextRequest, context?: any) => Promise<NextResponse>;
  PUT?: (request: NextRequest, context?: any) => Promise<NextResponse>;
  PATCH?: (request: NextRequest, context?: any) => Promise<NextResponse>;
  DELETE?: (request: NextRequest, context?: any) => Promise<NextResponse>;
}) {
  return async function handler(request: NextRequest, context?: any): Promise<NextResponse> {
    try {
      const method = request.method as keyof typeof handlers;
      const methodHandler = handlers[method];

      if (!methodHandler) {
        return createErrorResponse(
          'METHOD_NOT_ALLOWED',
          `Method ${method} not allowed`,
          405
        );
      }

      return await methodHandler(request, context);
    } catch (error) {
      console.error('API handler error:', error);
      return createErrorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred',
        500
      );
    }
  };
}

// Hash generation for deduplication
export async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// URL parameter extraction
export function getSearchParams(request: NextRequest) {
  return Object.fromEntries(request.nextUrl.searchParams.entries());
}