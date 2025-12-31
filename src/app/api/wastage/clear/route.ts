import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function DELETE(request: NextRequest) {
  try {
    const result = await prisma.wastageRecord.deleteMany({});

    return createSuccessResponse(
      { deletedCount: result.count },
      `Deleted ${result.count} wastage records`
    );
  } catch (error: any) {
    console.error('Clear wastage data error:', error);
    return createErrorResponse(
      'CLEAR_ERROR',
      `Failed to clear wastage data: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
