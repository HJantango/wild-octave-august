import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

// GET - Load saved state
export async function GET() {
  try {
    // Get the most recent shelf checker state
    const state = await prisma.setting.findUnique({
      where: { key: 'shelf_checker_state' }
    });

    if (!state) {
      return NextResponse.json({ 
        success: true, 
        data: { checkedItems: {}, labelNeeds: {}, savedAt: null } 
      });
    }

    const parsed = JSON.parse(state.value);
    return NextResponse.json({ 
      success: true, 
      data: {
        ...parsed,
        savedAt: state.updatedAt
      }
    });
  } catch (error) {
    console.error('Failed to load shelf checker state:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to load state' 
    }, { status: 500 });
  }
}

// POST - Save state
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkedItems, labelNeeds } = body;

    // Count stats for the backup
    const checkedCount = Object.keys(checkedItems || {}).filter(k => checkedItems[k]).length;
    const missingCount = Object.values(labelNeeds || {}).filter(v => v === 'missing').length;
    const updateCount = Object.values(labelNeeds || {}).filter(v => v === 'update').length;

    const stateData = JSON.stringify({
      checkedItems: checkedItems || {},
      labelNeeds: labelNeeds || {},
      stats: {
        checkedCount,
        missingLabels: missingCount,
        needsUpdate: updateCount,
      },
      savedAt: new Date().toISOString(),
      savedBy: 'manual'
    });

    // Upsert the state
    await prisma.setting.upsert({
      where: { key: 'shelf_checker_state' },
      update: { value: stateData },
      create: { key: 'shelf_checker_state', value: stateData }
    });

    // Also save a backup with timestamp (keep last 10)
    const backupKey = `shelf_checker_backup_${Date.now()}`;
    await prisma.setting.create({
      data: { key: backupKey, value: stateData }
    });

    // Clean up old backups (keep last 10)
    const backups = await prisma.setting.findMany({
      where: { key: { startsWith: 'shelf_checker_backup_' } },
      orderBy: { key: 'desc' },
      skip: 10
    });
    
    if (backups.length > 0) {
      await prisma.setting.deleteMany({
        where: { key: { in: backups.map(b => b.key) } }
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Saved! ${checkedCount} items checked, ${missingCount} missing labels, ${updateCount} need updates`,
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to save shelf checker state:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to save state' 
    }, { status: 500 });
  }
}
