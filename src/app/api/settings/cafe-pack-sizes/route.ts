import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// Default pack sizes - items sold by the piece but ordered as whole units
// Format: item name pattern -> { packSize: pieces per unit, unitName: what you order }
const DEFAULT_PACK_SIZES: Record<string, { packSize: number; unitName: string }> = {
  // Liz Jackson cakes - sold as slices, ordered as whole cakes
  'gf chocolate cake': { packSize: 12, unitName: 'cake' },
  'gf carrot cake': { packSize: 12, unitName: 'cake' },
  'gf lemon cake': { packSize: 12, unitName: 'cake' },
  'gf orange cake': { packSize: 12, unitName: 'cake' },
  // Generic patterns
  'cake': { packSize: 12, unitName: 'cake' },
  'cheesecake': { packSize: 12, unitName: 'cake' },
  // Pies - already handled separately but include for reference
  'cheese & spinach': { packSize: 16, unitName: 'box' },
  'energy roll': { packSize: 16, unitName: 'box' },
};

export type PackSizeConfig = Record<string, { packSize: number; unitName: string }>;

// GET - Fetch current pack sizes config
export async function GET() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'cafe-pack-sizes' },
    });

    if (!setting) {
      return createSuccessResponse({
        packSizes: DEFAULT_PACK_SIZES,
        isDefault: true,
      });
    }

    return createSuccessResponse({
      packSizes: setting.value as PackSizeConfig,
      isDefault: false,
      updatedAt: setting.updatedAt,
    });
  } catch (error: any) {
    return createErrorResponse('SETTINGS_ERROR', error.message, 500);
  }
}

// POST - Update pack sizes config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate structure - should be Record<string, { packSize: number, unitName: string }>
    const packSizes: PackSizeConfig = {};
    
    if (typeof body.packSizes === 'object') {
      for (const [key, value] of Object.entries(body.packSizes)) {
        if (typeof value === 'object' && value !== null) {
          const v = value as { packSize?: number; unitName?: string };
          if (typeof v.packSize === 'number' && typeof v.unitName === 'string') {
            packSizes[key.toLowerCase()] = {
              packSize: v.packSize,
              unitName: v.unitName,
            };
          }
        }
      }
    }

    // Merge with defaults if adding
    const finalConfig = body.replace ? packSizes : { ...DEFAULT_PACK_SIZES, ...packSizes };

    const setting = await prisma.settings.upsert({
      where: { key: 'cafe-pack-sizes' },
      create: {
        key: 'cafe-pack-sizes',
        value: finalConfig,
        description: 'Pack sizes for cafe items - maps item names to pieces per unit (e.g., cake = 12 slices)',
      },
      update: {
        value: finalConfig,
      },
    });

    return createSuccessResponse({
      packSizes: setting.value,
      updatedAt: setting.updatedAt,
      message: 'Cafe pack sizes updated successfully',
    });
  } catch (error: any) {
    return createErrorResponse('SETTINGS_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';
