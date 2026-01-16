import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';

type CSVRow = {
  Date: string;
  Time: string;
  Category: string;
  Item: string;
  Qty: string;
  'Price Point Name': string;
};

type PieSale = {
  date: Date;
  time: string;
  variation: string;
  quantity: number;
  dayOfWeek: number;
  hour: number;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();

    // Parse CSV
    const parseResult = Papa.parse<CSVRow>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
      console.error('CSV parsing errors:', parseResult.errors);
      return NextResponse.json(
        { error: 'Failed to parse CSV file' },
        { status: 400 }
      );
    }

    // Filter for pie sales (both regular and GF pies)
    const pieSales: PieSale[] = [];

    for (const row of parseResult.data) {
      if ((row.Item === 'Pies' || row.Item === 'GF pies') && row['Price Point Name']) {
        // Skip Ratatouille pies
        if (row['Price Point Name'].toLowerCase().includes('ratatouille')) {
          continue;
        }

        const date = new Date(row.Date);
        const quantity = parseFloat(row.Qty);
        const hour = parseInt(row.Time.split(':')[0]);

        pieSales.push({
          date,
          time: row.Time,
          variation: row['Price Point Name'],
          quantity,
          dayOfWeek: date.getDay(),
          hour,
        });
      }
    }

    if (pieSales.length === 0) {
      return NextResponse.json(
        { error: 'No pie sales found in the CSV file' },
        { status: 400 }
      );
    }

    // Calculate date range
    const dates = pieSales.map(s => s.date.getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Count actual occurrences of each day of week in the date range
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    const currentDate = new Date(minDate);
    while (currentDate <= maxDate) {
      dayOfWeekCounts[currentDate.getDay()]++;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Group by variation
    const variationMap = new Map<string, PieSale[]>();
    for (const sale of pieSales) {
      if (!variationMap.has(sale.variation)) {
        variationMap.set(sale.variation, []);
      }
      variationMap.get(sale.variation)!.push(sale);
    }

    // Calculate stats per variation
    const variations = Array.from(variationMap.entries()).map(([name, sales]) => {
      const totalSold = sales.reduce((sum, s) => sum + s.quantity, 0);
      const avgPerDay = totalSold / totalDays;

      // Delivery period is 3-4 days (Tue-Fri or Fri-Tue)
      const avgPerDeliveryPeriod = avgPerDay * 3.5;

      // Calculate sales by day of week for this variation
      const salesByDay = new Map<number, number>();
      for (const sale of sales) {
        const current = salesByDay.get(sale.dayOfWeek) || 0;
        salesByDay.set(sale.dayOfWeek, current + sale.quantity);
      }

      // Calculate sales by hour for this variation
      const salesByHour = new Map<number, number>();
      for (const sale of sales) {
        const current = salesByHour.get(sale.hour) || 0;
        salesByHour.set(sale.hour, current + sale.quantity);
      }

      // Find peak hours (top 3)
      const hourSales = Array.from(salesByHour.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      const peakHours = hourSales.map(([hour]) => `${hour}:00`);

      // Find peak days
      const daySales = Array.from(salesByDay.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const peakDays = daySales.map(([day]) => dayNames[day]);

      // Calculate daily recommendations using consistent day counts
      // Use the actual number of each day of week in the entire date range
      const avgByDay: number[] = [];
      for (let i = 0; i < 7; i++) {
        const dayTotal = sales
          .filter(s => s.dayOfWeek === i)
          .reduce((sum, s) => sum + s.quantity, 0);
        // Use the actual count of this day of week in the date range
        avgByDay[i] = dayOfWeekCounts[i] > 0 ? dayTotal / dayOfWeekCounts[i] : 0;
      }

      // Return raw averages - buffers and rounding will be applied on frontend
      const recommendedDaily = {
        sunday: avgByDay[0],
        monday: avgByDay[1],
        tuesday: avgByDay[2],
        wednesday: avgByDay[3],
        thursday: avgByDay[4],
        friday: avgByDay[5],
        saturday: avgByDay[6],
      };

      return {
        name,
        totalSold,
        avgPerDay,
        avgPerDeliveryPeriod,
        recommendedDaily,
        peakHours,
        peakDays,
      };
    });

    // Sort variations by total sold (descending)
    variations.sort((a, b) => b.totalSold - a.totalSold);

    // Time analysis across all pies

    // Hourly sales
    const hourlySales = new Map<number, number>();
    for (const sale of pieSales) {
      const current = hourlySales.get(sale.hour) || 0;
      hourlySales.set(sale.hour, current + sale.quantity);
    }
    const hourlyData = Array.from(hourlySales.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, sales]) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        sales,
      }));

    // Period breakdown (Morning: 7-11, Lunch: 11-14, Afternoon: 14-17, Evening: 17+)
    const periods = {
      'Morning (7-11am)': 0,
      'Lunch (11am-2pm)': 0,
      'Afternoon (2-5pm)': 0,
      'Evening (5pm+)': 0,
    };
    for (const sale of pieSales) {
      if (sale.hour >= 7 && sale.hour < 11) {
        periods['Morning (7-11am)'] += sale.quantity;
      } else if (sale.hour >= 11 && sale.hour < 14) {
        periods['Lunch (11am-2pm)'] += sale.quantity;
      } else if (sale.hour >= 14 && sale.hour < 17) {
        periods['Afternoon (2-5pm)'] += sale.quantity;
      } else {
        periods['Evening (5pm+)'] += sale.quantity;
      }
    }
    const periodData = Object.entries(periods).map(([period, sales]) => ({
      period,
      sales,
    }));

    // Day of week sales
    const dayOfWeekSales = new Map<number, number>();
    for (const sale of pieSales) {
      const current = dayOfWeekSales.get(sale.dayOfWeek) || 0;
      dayOfWeekSales.set(sale.dayOfWeek, current + sale.quantity);
    }
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeekData = Array.from(dayOfWeekSales.entries())
      .sort((a, b) => {
        // Sort Mon-Sun (1,2,3,4,5,6,0)
        const order = [1, 2, 3, 4, 5, 6, 0];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      })
      .map(([day, sales]) => ({
        day: dayNames[day],
        sales,
      }));

    const totalPiesSold = pieSales.reduce((sum, s) => sum + s.quantity, 0);

    const result = {
      variations,
      timeAnalysis: {
        hourly: hourlyData,
        periods: periodData,
        dayOfWeek: dayOfWeekData,
      },
      totalPiesSold,
      totalDays,
      dateRange: {
        start: minDate.toISOString().split('T')[0],
        end: maxDate.toISOString().split('T')[0],
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error analyzing pie sales:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
