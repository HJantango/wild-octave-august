import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

const DEFAULT_CONFIG = {
  vendors: ['Byron Bay Gourmet Pies', 'Byron Gourmet Pies'],
  extraItems: ['samosa', 'samosas'],
  excludeItems: ['ratatouille'],
};

// GET - Fetch current config
export async function GET() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'pie-report-config' },
    });

    if (!setting) {
      return createSuccessResponse({
        config: DEFAULT_CONFIG,
        isDefault: true,
      });
    }

    return createSuccessResponse({
      config: setting.value,
      isDefault: false,
      updatedAt: setting.updatedAt,
    });
  } catch (error: any) {
    return createErrorResponse('SETTINGS_ERROR', error.message, 500);
  }
}

// POST - Update config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate structure
    const config = {
      vendors: Array.isArray(body.vendors) ? body.vendors : DEFAULT_CONFIG.vendors,
      extraItems: Array.isArray(body.extraItems) ? body.extraItems : DEFAULT_CONFIG.extraItems,
      excludeItems: Array.isArray(body.excludeItems) ? body.excludeItems : DEFAULT_CONFIG.excludeItems,
    };

    const setting = await prisma.settings.upsert({
      where: { key: 'pie-report-config' },
      create: {
        key: 'pie-report-config',
        value: config,
        description: 'Configuration for the pie sales report - specifies which vendors and items to include',
      },
      update: {
        value: config,
      },
    });

    return createSuccessResponse({
      config: setting.value,
      updatedAt: setting.updatedAt,
      message: 'Pie report config updated successfully',
    });
  } catch (error: any) {
    return createErrorResponse('SETTINGS_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';
