import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';
import { realSquareService, CatalogChangeItem } from '@/services/real-square-service';
import { getDefaultMarkup } from '@/lib/pricing';

export const maxDuration = 60;

/**
 * Preview what changes would be applied to Square catalog from this invoice.
 * READ-ONLY — no changes are made.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoiceId = params.id;

  try {
    // Get invoice with line items
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        vendor: { select: { name: true } },
        lineItems: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      return NextResponse.json({ error: 'Invoice has no line items. Process it first.' }, { status: 400 });
    }

    console.log(`[Square Preview] Previewing ${invoice.lineItems.length} items from invoice ${invoiceId}`);

    // Build change items from invoice line items
    const changeItems: CatalogChangeItem[] = [];
    for (const li of invoice.lineItems) {
      const markup = Number(li.markup) || await getDefaultMarkup(li.category);
      // Use effective unit cost (accounts for pack size) — this is what goes to Square
      const packSize = li.detectedPackSize || 1;
      const rawCost = Number(li.unitCostExGst) || 0;
      const costExGst = packSize > 1 ? rawCost / packSize : rawCost;
      const sellExGst = costExGst * markup;
      const sellIncGst = li.hasGst ? sellExGst * 1.1 : sellExGst;

      changeItems.push({
        name: li.name,
        costExGst,
        sellPriceIncGst: Math.round(sellIncGst * 100) / 100,
        markup,
        category: li.category,
        hasGst: li.hasGst,
      });
    }

    // Get preview from Square (read-only)
    const preview = await realSquareService.previewCatalogChanges(changeItems);

    console.log(`[Square Preview] Result: ${preview.summary.priceUpdates} updates, ${preview.summary.newItems} new, ${preview.summary.unchanged} unchanged`);

    return NextResponse.json({
      status: 'success',
      data: {
        invoiceId,
        vendor: invoice.vendor?.name,
        preview,
      },
    });

  } catch (error: any) {
    console.error('[Square Preview] Error:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message || 'Failed to preview Square changes',
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
