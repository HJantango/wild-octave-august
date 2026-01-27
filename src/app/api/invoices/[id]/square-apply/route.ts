import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';
import { realSquareService, CatalogChange } from '@/services/real-square-service';

export const maxDuration = 120;

/**
 * Apply approved changes to Square catalog.
 * Requires explicit list of changes to apply (from preview).
 * Logs everything for audit trail.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoiceId = params.id;

  try {
    const body = await req.json();
    const { changes, locationId } = body as {
      changes: CatalogChange[];
      locationId?: string;
    };

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({
        error: 'No changes provided. Run preview first, then send approved changes.',
      }, { status: 400 });
    }

    // Only apply actionable changes (updates and creates)
    const actionable = changes.filter(
      c => c.action === 'UPDATE_PRICE' || c.action === 'CREATE'
    );

    if (actionable.length === 0) {
      return NextResponse.json({
        status: 'success',
        data: {
          message: 'No changes to apply — all items are already up to date.',
          applied: 0,
        },
      });
    }

    // Verify invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { vendor: { select: { name: true } } },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get location ID if not provided
    let targetLocationId = locationId;
    if (!targetLocationId) {
      const locations = await realSquareService.getLocations();
      const active = locations.find(l => l.status === 'ACTIVE');
      if (!active) {
        return NextResponse.json({
          error: 'No active Square location found',
        }, { status: 400 });
      }
      targetLocationId = active.id;
    }

    console.log(`[Square Apply] Applying ${actionable.length} changes from invoice ${invoiceId} to location ${targetLocationId}`);

    // Apply changes
    const result = await realSquareService.applyCatalogChanges(actionable, targetLocationId);

    // Log the apply action on the invoice
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'POSTED',
        parsedJson: {
          ...(invoice.parsedJson as any || {}),
          squareApply: {
            appliedAt: new Date().toISOString(),
            locationId: targetLocationId,
            summary: result.summary,
            details: result.results,
          },
        },
        updatedAt: new Date(),
      },
    });

    console.log(`[Square Apply] Done: ${result.summary.succeeded} succeeded, ${result.summary.failed} failed`);

    return NextResponse.json({
      status: 'success',
      data: {
        invoiceId,
        vendor: invoice.vendor?.name,
        result,
      },
    });

  } catch (error: any) {
    console.error('[Square Apply] Error:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message || 'Failed to apply Square changes',
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
