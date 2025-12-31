import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { printSheetSchema } from '@/lib/validations';

async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validation = validateRequest(printSheetSchema, searchParams);

    if (!validation.success) {
      return validation.error;
    }

    const { vendorId, category, includeStock, includeSalesData } = validation.data;

    // Build where clause
    const where: any = {};
    if (vendorId) where.vendorId = vendorId;
    if (category) where.category = category;

    // Fetch items grouped by category
    const items = await prisma.item.findMany({
      where,
      include: {
        vendor: {
          select: { id: true, name: true },
        },
        inventoryItem: includeStock ? {
          select: { currentStock: true },
        } : false,
      },
      orderBy: [
        { category: 'asc' },
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    // Group items by category
    const groupedItems = items.reduce((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push({
        id: item.id,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        vendor: item.vendor?.name,
        currentStock: item.inventoryItem?.currentStock || 0,
        currentSellIncGst: item.currentSellIncGst,
        displayOrder: item.displayOrder,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return createSuccessResponse({
      categories: Object.keys(groupedItems).sort(),
      itemsByCategory: groupedItems,
      totalItems: items.length,
      vendorId,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Print sheet generation error:', error);
    return createErrorResponse('PRINT_SHEET_ERROR', 'Failed to generate print sheet', 500);
  }
}

export { GET };
export const dynamic = 'force-dynamic';
