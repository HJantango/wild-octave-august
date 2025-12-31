import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { bulkUpdatePositionsSchema } from '@/lib/validations';

async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateRequest(bulkUpdatePositionsSchema, body);

    if (!validation.success) {
      return validation.error;
    }

    const { updates } = validation.data;

    // Update all items in a transaction
    await prisma.$transaction(
      updates.map(update =>
        prisma.item.update({
          where: { id: update.id },
          data: { displayOrder: update.displayOrder },
        })
      )
    );

    return createSuccessResponse(
      { updatedCount: updates.length },
      `Successfully updated ${updates.length} item positions`
    );
  } catch (error) {
    console.error('Bulk update positions error:', error);
    return createErrorResponse('BULK_UPDATE_ERROR', 'Failed to update item positions', 500);
  }
}

export { POST };
export const dynamic = 'force-dynamic';
