import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { bulkCategorizeSchema } from '@/lib/validations';

async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateRequest(bulkCategorizeSchema, body);

    if (!validation.success) {
      return validation.error;
    }

    const { itemIds, category, subcategory } = validation.data;

    // Build update data object
    const updateData: any = {};
    if (category !== undefined) updateData.category = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory;

    // Update all items
    const result = await prisma.item.updateMany({
      where: { id: { in: itemIds } },
      data: updateData,
    });

    return createSuccessResponse(
      { updatedCount: result.count },
      `Successfully updated ${result.count} items`
    );
  } catch (error) {
    console.error('Bulk categorize error:', error);
    return createErrorResponse('BULK_CATEGORIZE_ERROR', 'Failed to categorize items', 500);
  }
}

export { POST };
export const dynamic = 'force-dynamic';
