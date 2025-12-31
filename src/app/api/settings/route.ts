import { NextRequest } from 'next/server';
import { prisma, createMethodHandler, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { updateSettingsSchema } from '@/lib/validations';

async function GET() {
  try {
    const settings = await prisma.settings.findMany({
      orderBy: { key: 'asc' },
    });

    // Convert to key-value object for easier consumption
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = {
        value: setting.value,
        description: setting.description,
        updatedAt: setting.updatedAt,
      };
      return acc;
    }, {} as Record<string, any>);

    return createSuccessResponse(settingsObject);
  } catch (error) {
    console.error('Settings fetch error:', error);
    return createErrorResponse('SETTINGS_FETCH_ERROR', 'Failed to fetch settings', 500);
  }
}

async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateRequest(updateSettingsSchema, body);

    if (!validation.success) {
      return validation.error;
    }

    const { key, value, description } = validation.data;

    const setting = await prisma.settings.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });

    return createSuccessResponse(setting, 'Setting updated successfully');
  } catch (error) {
    console.error('Settings update error:', error);
    return createErrorResponse('SETTINGS_UPDATE_ERROR', 'Failed to update setting', 500);
  }
}

async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support bulk updates
    if (Array.isArray(body)) {
      const results = [];
      
      for (const settingData of body) {
        const validation = validateRequest(updateSettingsSchema, settingData);
        if (!validation.success) {
          return validation.error;
        }

        const { key, value, description } = validation.data;
        
        const setting = await prisma.settings.upsert({
          where: { key },
          update: { value, description },
          create: { key, value, description },
        });
        
        results.push(setting);
      }

      return createSuccessResponse(results, 'Settings updated successfully');
    } else {
      // Single setting update
      const validation = validateRequest(updateSettingsSchema, body);
      if (!validation.success) {
        return validation.error;
      }

      const { key, value, description } = validation.data;

      const setting = await prisma.settings.upsert({
        where: { key },
        update: { value, description },
        create: { key, value, description },
      });

      return createSuccessResponse(setting, 'Setting updated successfully');
    }
  } catch (error) {
    console.error('Settings batch update error:', error);
    return createErrorResponse('SETTINGS_UPDATE_ERROR', 'Failed to update settings', 500);
  }
}

export { GET, POST, PATCH };
export const dynamic = 'force-dynamic';