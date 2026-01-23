import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, handleFileUpload, generateHash } from '@/lib/api-utils';
import { SquareCSVParser } from '@/lib/csv-parser';
import { withRetry } from '@/lib/db-retry';

export async function POST(request: NextRequest) {
  try {
    // Handle CSV file upload
    const fileResult = await handleFileUpload(
      request,
      ['text/csv', '.csv', 'application/csv'],
      150 * 1024 * 1024 // 150MB limit for CSV
    );

    if (!fileResult.success) {
      return fileResult.error;
    }

    const { buffer, filename } = fileResult;

    // Convert buffer to string
    const csvText = buffer.toString('utf-8');

    if (csvText.length < 50) {
      return createErrorResponse('INVALID_CSV', 'CSV file appears to be empty or too small', 400);
    }

    try {
      // Parse the CSV
      const parsedData = await SquareCSVParser.parseCSV(csvText);

      // Check if this report has already been uploaded (with retry)
      const existingReport = await withRetry(() =>
        prisma.salesReport.findFirst({
          where: { hash: parsedData.hash },
        })
      );

      if (existingReport) {
        return createErrorResponse(
          'DUPLICATE_REPORT',
          'This sales report has already been uploaded',
          409
        );
      }

      // Save the sales report (with retry)
      const savedReport = await withRetry(() =>
        prisma.$transaction(async (tx) => {
        // Create sales report record
        const report = await tx.salesReport.create({
          data: {
            source: 'square_item_sales_detail',
            reportPeriodStart: parsedData.summary.dateRange.start,
            reportPeriodEnd: parsedData.summary.dateRange.end,
            rawCsv: buffer,
            parsedJson: {
              filename,
              summary: parsedData.summary,
              uploadedAt: new Date().toISOString(),
              rowCount: parsedData.rows.length,
            },
            hash: parsedData.hash,
          },
        });

        // Create sales aggregates for faster querying
        const aggregates: Array<{
          date: Date;
          category: string | null;
          itemName: string | null;
          revenue: number;
          quantity: number;
          margin: number | null;
        }> = [];

        // Daily aggregates by item (with category info)
        const dailyItems = new Map<string, Map<string, { revenue: number; quantity: number; category: string }>>();

        for (const row of parsedData.rows) {
          const dateKey = row.date.toISOString().split('T')[0];
          
          // Item aggregates with category
          if (!dailyItems.has(dateKey)) {
            dailyItems.set(dateKey, new Map());
          }
          const itemMap = dailyItems.get(dateKey)!;
          const itemData = itemMap.get(row.itemName) || { revenue: 0, quantity: 0, category: row.category };
          itemMap.set(row.itemName, {
            revenue: itemData.revenue + row.netSales,
            quantity: itemData.quantity + row.quantity,
            category: row.category, // Keep category for reference
          });
        }

        // Create item aggregates (only one record per item per day)
        for (const [dateKey, itemMap] of dailyItems) {
          const date = new Date(dateKey);
          for (const [itemName, data] of itemMap) {
            aggregates.push({
              date,
              category: data.category,
              itemName,
              revenue: data.revenue,
              quantity: data.quantity,
              margin: null,
            });
          }
        }

        // Before inserting, check for existing records in date range to prevent duplicates
        const dateRange = {
          start: parsedData.summary.dateRange.start,
          end: parsedData.summary.dateRange.end
        };
        
        const existingAggregates = await tx.salesAggregate.findMany({
          where: {
            date: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
          select: {
            date: true,
            category: true,
            itemName: true,
            revenue: true,
            quantity: true,
          },
        });

        // Create a Set of existing record keys for fast lookup
        const existingKeys = new Set(
          existingAggregates.map(record => 
            `${record.date.toISOString().split('T')[0]}|${record.category || 'null'}|${record.itemName || 'null'}|${record.revenue}|${record.quantity}`
          )
        );

        // Filter out aggregates that already exist
        const newAggregates = aggregates.filter(agg => {
          const key = `${agg.date.toISOString().split('T')[0]}|${agg.category || 'null'}|${agg.itemName || 'null'}|${agg.revenue}|${agg.quantity}`;
          return !existingKeys.has(key);
        });

        console.log(`Filtered ${aggregates.length - newAggregates.length} duplicate aggregates, inserting ${newAggregates.length} new records`);

        // Insert only new aggregates in batches
        const batchSize = 100;
        for (let i = 0; i < newAggregates.length; i += batchSize) {
          const batch = newAggregates.slice(i, i + batchSize);
          await tx.salesAggregate.createMany({
            data: batch,
            skipDuplicates: true,
          });
        }

        return { report, newAggregatesCount: newAggregates.length };
      }, {
        timeout: 300000, // 5 minutes timeout for large CSV files
      })
      );

      return createSuccessResponse(
        {
          reportId: savedReport.report.id,
          summary: parsedData.summary,
          rowsProcessed: parsedData.rows.length,
          aggregatesCreated: savedReport.newAggregatesCount,
        },
        'Sales report uploaded and processed successfully',
        201
      );

    } catch (parseError) {
      console.error('CSV parsing error:', parseError);
      return createErrorResponse(
        'CSV_PARSE_ERROR',
        `Failed to parse CSV file: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`,
        400
      );
    }

  } catch (error) {
    console.error('Sales upload error:', error);
    return createErrorResponse('UPLOAD_ERROR', 'Failed to upload sales data', 500);
  }
}

export const dynamic = 'force-dynamic';

// Increase body size limit for large CSV uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '150mb',
    },
  },
};