import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// Use direct PrismaClient to avoid build-time issues
const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

const SHELF_CHECKER_KEY = 'shelf-checker-state';

interface ShelfCheckerState {
  checkedItems: { [itemId: string]: boolean };
  labelNeeds: { [itemId: string]: 'missing' | 'update' | null };
  savedAt: string;
}

export async function GET() {
  try {
    console.log('📋 Loading shelf checker state from database...');
    
    const setting = await prisma.settings.findUnique({
      where: { key: SHELF_CHECKER_KEY }
    });

    if (setting) {
      const state = setting.value as ShelfCheckerState;
      console.log(`✅ Loaded shelf checker state from ${state.savedAt}`);
      return createSuccessResponse({ 
        ...state,
        success: true 
      });
    } else {
      // No saved state yet
      return createSuccessResponse({ 
        checkedItems: {}, 
        labelNeeds: {}, 
        savedAt: null,
        success: false 
      });
    }
  } catch (error: any) {
    console.error('❌ Error loading shelf checker state:', error);
    return createErrorResponse('SHELF_STATE_LOAD_ERROR', error.message, 500);
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkedItems, labelNeeds } = body;

    if (!checkedItems || !labelNeeds) {
      return createErrorResponse('INVALID_DATA', 'Missing checkedItems or labelNeeds', 400);
    }

    console.log('💾 Saving shelf checker state to database...');
    
    const now = new Date().toISOString();
    const state: ShelfCheckerState = {
      checkedItems,
      labelNeeds,
      savedAt: now
    };

    // Upsert the setting
    await prisma.settings.upsert({
      where: { key: SHELF_CHECKER_KEY },
      create: {
        key: SHELF_CHECKER_KEY,
        value: state,
        description: 'Shelf price checker progress state'
      },
      update: {
        value: state,
        updatedAt: new Date()
      }
    });

    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    const missingLabels = Object.values(labelNeeds).filter(v => v === 'missing').length;
    const updateLabels = Object.values(labelNeeds).filter(v => v === 'update').length;

    console.log(`✅ Saved shelf checker state: ${checkedCount} checked, ${missingLabels} missing labels, ${updateLabels} updates`);
    
    return createSuccessResponse({ 
      message: `Saved successfully at ${new Date(now).toLocaleString()}`, 
      savedAt: now,
      stats: {
        checkedCount,
        missingLabels,
        updateLabels
      }
    });

  } catch (error: any) {
    console.error('❌ Error saving shelf checker state:', error);
    return createErrorResponse('SHELF_STATE_SAVE_ERROR', error.message, 500);
  } finally {
    await prisma.$disconnect();
  }
}