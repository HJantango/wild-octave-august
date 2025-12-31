import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';

const pricingSimulationSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  primaryMarkupType: z.enum(['percentage', 'dollar']),
  primaryMarkupValue: z.number().min(0),
  secondaryMarkupType: z.enum(['percentage', 'dollar']).optional(),
  secondaryMarkupValue: z.number().min(0).optional(),
  periodType: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    
    // Convert string values to appropriate types
    const processedParams = {
      ...searchParams,
      primaryMarkupValue: parseFloat(searchParams.primaryMarkupValue || '0'),
      secondaryMarkupValue: searchParams.secondaryMarkupValue ? parseFloat(searchParams.secondaryMarkupValue) : undefined,
    };

    const validation = validateRequest(pricingSimulationSchema, processedParams);

    if (!validation.success) {
      return validation.error;
    }

    const { 
      itemName, 
      startDate, 
      endDate, 
      primaryMarkupType, 
      primaryMarkupValue,
      secondaryMarkupType,
      secondaryMarkupValue,
      periodType 
    } = validation.data;

    // Build date filter
    const where: any = {
      itemName: { equals: itemName }
    };

    // Default to last 6 months if no dates specified
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    } else {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      where.date = { gte: sixMonthsAgo };
    }

    console.log(`💰 Pricing simulation for "${itemName}" with primary markup: ${primaryMarkupValue}${primaryMarkupType === 'percentage' ? '%' : '$'}`);

    // Get sales data for the item
    const salesData = await prisma.salesAggregate.findMany({
      where,
      select: {
        date: true,
        quantity: true,
        revenue: true,
      },
      orderBy: {
        date: 'asc'
      }
    });

    console.log(`💰 Found ${salesData.length} records for pricing simulation`);

    if (salesData.length === 0) {
      return createSuccessResponse({
        itemName,
        simulation: {
          currentStats: {
            totalQuantity: 0,
            totalRevenue: 0,
            averagePrice: 0,
            periodsAnalyzed: 0,
          },
          primaryScenario: {
            newTotalRevenue: 0,
            additionalRevenue: 0,
            newAveragePrice: 0,
            markupDescription: `${primaryMarkupValue}${primaryMarkupType === 'percentage' ? '%' : '$'} markup`,
          },
          secondaryScenario: null,
          comparison: null,
        }
      });
    }

    // Calculate current stats
    const totalQuantity = salesData.reduce((sum, record) => sum + Number(record.quantity || 0), 0);
    const totalRevenue = salesData.reduce((sum, record) => sum + Number(record.revenue || 0), 0);
    const averagePrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0;

    // Group data by period for analysis
    const groupedData = groupDataByPeriod(salesData, periodType);
    const periodsAnalyzed = Object.keys(groupedData).length;

    // Calculate primary scenario
    const primaryScenario = calculateMarkupScenario(
      totalQuantity,
      totalRevenue,
      averagePrice,
      primaryMarkupType,
      primaryMarkupValue
    );

    // Calculate secondary scenario if provided
    let secondaryScenario = null;
    let comparison = null;

    if (secondaryMarkupType && secondaryMarkupValue !== undefined) {
      secondaryScenario = calculateMarkupScenario(
        totalQuantity,
        totalRevenue,
        averagePrice,
        secondaryMarkupType,
        secondaryMarkupValue
      );

      comparison = {
        revenueDifference: secondaryScenario.newTotalRevenue - primaryScenario.newTotalRevenue,
        additionalRevenueDifference: secondaryScenario.additionalRevenue - primaryScenario.additionalRevenue,
        betterOption: secondaryScenario.additionalRevenue > primaryScenario.additionalRevenue ? 'secondary' : 'primary',
      };
    }

    // Calculate period-based projections
    const periodProjections = calculatePeriodProjections(groupedData, averagePrice, primaryMarkupType, primaryMarkupValue, periodType);

    return createSuccessResponse({
      itemName,
      dateRange: {
        start: salesData.length > 0 ? Math.min(...salesData.map(r => r.date.getTime())) : null,
        end: salesData.length > 0 ? Math.max(...salesData.map(r => r.date.getTime())) : null,
      },
      simulation: {
        currentStats: {
          totalQuantity,
          totalRevenue,
          averagePrice,
          periodsAnalyzed,
        },
        primaryScenario,
        secondaryScenario,
        comparison,
        periodProjections,
      }
    });

  } catch (error) {
    console.error('Pricing simulation error:', error);
    return createErrorResponse('SIMULATION_ERROR', 'Failed to calculate pricing simulation', 500);
  }
}

function groupDataByPeriod(salesData: any[], periodType: string) {
  const grouped: Record<string, { quantity: number; revenue: number }> = {};

  salesData.forEach(record => {
    let periodKey: string;
    const date = new Date(record.date);

    switch (periodType) {
      case 'daily':
        periodKey = date.toISOString().split('T')[0];
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
        break;
      case 'monthly':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        periodKey = date.toISOString().split('T')[0];
    }

    if (!grouped[periodKey]) {
      grouped[periodKey] = { quantity: 0, revenue: 0 };
    }

    grouped[periodKey].quantity += Number(record.quantity || 0);
    grouped[periodKey].revenue += Number(record.revenue || 0);
  });

  return grouped;
}

function calculateMarkupScenario(
  totalQuantity: number,
  totalRevenue: number,
  averagePrice: number,
  markupType: 'percentage' | 'dollar',
  markupValue: number
) {
  let newAveragePrice: number;

  if (markupType === 'percentage') {
    newAveragePrice = averagePrice * (1 + markupValue / 100);
  } else {
    newAveragePrice = averagePrice + markupValue;
  }

  const newTotalRevenue = totalQuantity * newAveragePrice;
  const additionalRevenue = newTotalRevenue - totalRevenue;

  return {
    newTotalRevenue,
    additionalRevenue,
    newAveragePrice,
    markupDescription: `${markupValue}${markupType === 'percentage' ? '%' : '$'} markup`,
  };
}

function calculatePeriodProjections(
  groupedData: Record<string, { quantity: number; revenue: number }>,
  averagePrice: number,
  markupType: 'percentage' | 'dollar',
  markupValue: number,
  periodType: string
) {
  const periods = Object.keys(groupedData).sort();
  const projections = periods.map(period => {
    const data = groupedData[period];
    const currentRevenue = data.revenue;
    
    let newAveragePrice: number;
    if (markupType === 'percentage') {
      newAveragePrice = averagePrice * (1 + markupValue / 100);
    } else {
      newAveragePrice = averagePrice + markupValue;
    }

    const projectedRevenue = data.quantity * newAveragePrice;
    const additionalRevenue = projectedRevenue - currentRevenue;

    return {
      period,
      currentRevenue,
      projectedRevenue,
      additionalRevenue,
      quantity: data.quantity,
    };
  });

  return projections;
}

export const dynamic = 'force-dynamic';