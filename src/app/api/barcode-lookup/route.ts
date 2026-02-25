import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

interface BarcodeResult {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  categoryName: string;
  found: boolean;
  matchedBy: 'barcode' | 'sku' | 'none';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const barcode = searchParams.get('barcode')?.trim();

    if (!barcode) {
      return createErrorResponse('MISSING_BARCODE', 'Barcode parameter is required', 400);
    }

    console.log(`🔍 Looking up barcode: "${barcode}"`);

    // SQUARE-FIRST PRINCIPLE: Search by barcode AND SKU across ALL items
    // GTINs are just numbers, so exact matches are fast
    let item = await prisma.item.findFirst({
      where: { barcode }  // Try exact barcode match first (fastest)
    });

    let matchedBy: 'barcode' | 'sku' = 'barcode';

    // If not found by barcode, try SKU (some items might use SKU field)
    if (!item) {
      item = await prisma.item.findFirst({
        where: { sku: barcode }
      });
      matchedBy = 'sku';
    }

    if (!item) {
      console.log(`❌ Barcode not found: "${barcode}"`);
      return createSuccessResponse({
        found: false,
        barcode,
        matchedBy: 'none' as const,
      } as BarcodeResult);
    }

    // matchedBy already determined above during the search

    console.log(`✅ Found item: "${item.name}" (matched by ${matchedBy})`);

    const result: BarcodeResult = {
      id: item.id,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      price: Number(item.currentSellIncGst),
      categoryName: item.category || 'Uncategorized',
      found: true,
      matchedBy,
    };

    return createSuccessResponse(result);
  } catch (error: any) {
    console.error('❌ Barcode lookup error:', error);
    return createErrorResponse('BARCODE_LOOKUP_ERROR', error.message, 500);
  }
}