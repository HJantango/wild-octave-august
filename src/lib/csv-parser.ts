export interface SquareSalesRow {
  date: Date;
  itemName: string;
  category: string;
  quantity: number;
  grossSales: number;
  netSales: number;
  discounts: number;
  tax: number;
  sku?: string;
  variation?: string;
}

export interface ParsedSalesData {
  rows: SquareSalesRow[];
  summary: {
    totalRevenue: number;
    totalQuantity: number;
    dateRange: {
      start: Date;
      end: Date;
    };
    uniqueItems: number;
    uniqueCategories: number;
  };
  hash: string;
}

export class SquareCSVParser {
  private static readonly EXPECTED_HEADERS = [
    'Date',
    'Item',
    'Category',
    'Qty',
    'Gross Sales',
    'Net Sales',
    'Discounts',
    'Tax',
  ];

  static async parseCSV(csvText: string): Promise<ParsedSalesData> {
    const lines = csvText.split('\n').map(line => line.trim()).filter(Boolean);
    
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least headers and one data row');
    }

    const headers = this.parseCSVLine(lines[0]);
    this.validateHeaders(headers);
    
    const rows: SquareSalesRow[] = [];
    const errors: string[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const cells = this.parseCSVLine(lines[i]);
        if (cells.length === 0 || cells.every(cell => !cell)) continue; // Skip empty rows
        
        const row = this.parseDataRow(headers, cells, i + 1);
        if (row) {
          rows.push(row);
        }
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (rows.length === 0) {
      throw new Error(`No valid data rows found. Errors: ${errors.join('; ')}`);
    }

    // Generate summary and hash
    const summary = this.generateSummary(rows);
    const hash = await this.generateHash(csvText);

    return {
      rows,
      summary,
      hash,
    };
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    
    return result;
  }

  private static validateHeaders(headers: string[]): void {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    
    for (const expectedHeader of this.EXPECTED_HEADERS) {
      const found = normalizedHeaders.some(h => 
        h.includes(expectedHeader.toLowerCase()) ||
        expectedHeader.toLowerCase().includes(h)
      );
      
      if (!found) {
        throw new Error(`Missing expected header: ${expectedHeader}. Found headers: ${headers.join(', ')}`);
      }
    }
  }

  private static parseDataRow(headers: string[], cells: string[], rowNumber: number): SquareSalesRow | null {
    if (cells.length < headers.length - 2) { // Allow some missing columns
      throw new Error(`Insufficient columns (expected ${headers.length}, got ${cells.length})`);
    }

    // Find column indices (case insensitive)
    const getColumnIndex = (columnName: string): number => {
      const index = headers.findIndex(h => 
        h.toLowerCase().includes(columnName.toLowerCase()) ||
        columnName.toLowerCase().includes(h.toLowerCase())
      );
      return index;
    };

    const dateIndex = getColumnIndex('date');
    const itemIndex = getColumnIndex('item');
    const categoryIndex = getColumnIndex('category');
    const qtyIndex = getColumnIndex('qty');
    const grossSalesIndex = getColumnIndex('gross sales');
    const netSalesIndex = getColumnIndex('net sales');
    const discountsIndex = getColumnIndex('discount');
    const taxIndex = getColumnIndex('tax');

    // Parse required fields
    const dateStr = cells[dateIndex]?.trim();
    const itemName = cells[itemIndex]?.trim();
    const category = cells[categoryIndex]?.trim() || 'Uncategorized';
    
    if (!dateStr || !itemName) {
      throw new Error('Missing required fields: date or item name');
    }

    // Parse date
    let date: Date;
    try {
      // Handle various date formats
      if (dateStr.includes('/')) {
        // MM/DD/YYYY or DD/MM/YYYY
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          // Assume MM/DD/YYYY (Square format)
          date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        } else {
          throw new Error('Invalid date format');
        }
      } else if (dateStr.includes('-')) {
        // YYYY-MM-DD
        date = new Date(dateStr);
      } else {
        throw new Error('Unrecognized date format');
      }
      
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
    } catch {
      throw new Error(`Invalid date format: ${dateStr}`);
    }

    // Parse numeric fields
    const quantity = this.parseNumeric(cells[qtyIndex], 'quantity', 0);
    const grossSales = this.parseNumeric(cells[grossSalesIndex], 'gross sales', 0);
    const netSales = this.parseNumeric(cells[netSalesIndex], 'net sales', grossSales);
    const discounts = this.parseNumeric(cells[discountsIndex], 'discounts', 0);
    const tax = this.parseNumeric(cells[taxIndex], 'tax', 0);

    // Basic validation
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    return {
      date,
      itemName,
      category,
      quantity,
      grossSales,
      netSales,
      discounts,
      tax,
    };
  }

  private static parseNumeric(value: string | undefined, fieldName: string, defaultValue: number = 0): number {
    if (!value || value.trim() === '') return defaultValue;
    
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$,\s]/g, '');
    const number = parseFloat(cleaned);
    
    if (isNaN(number)) {
      throw new Error(`Invalid ${fieldName}: ${value}`);
    }
    
    return number;
  }

  private static generateSummary(rows: SquareSalesRow[]) {
    const dates = rows.map(r => r.date).sort((a, b) => a.getTime() - b.getTime());
    const uniqueItems = new Set(rows.map(r => r.itemName)).size;
    const uniqueCategories = new Set(rows.map(r => r.category)).size;
    
    return {
      totalRevenue: rows.reduce((sum, row) => sum + row.netSales, 0),
      totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      dateRange: {
        start: dates[0],
        end: dates[dates.length - 1],
      },
      uniqueItems,
      uniqueCategories,
    };
  }

  private static async generateHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Sales aggregation utilities
export interface SalesSummary {
  totalRevenue: number;
  totalQuantity: number;
  averageOrderValue: number;
  topCategories: Array<{
    category: string;
    revenue: number;
    quantity: number;
    percentage: number;
  }>;
  topItems: Array<{
    itemName: string;
    category: string;
    revenue: number;
    quantity: number;
    percentage: number;
  }>;
  dailySales: Array<{
    date: string;
    revenue: number;
    quantity: number;
  }>;
}

export function generateSalesSummary(rows: SquareSalesRow[]): SalesSummary {
  const totalRevenue = rows.reduce((sum, row) => sum + row.netSales, 0);
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  
  // Group by category
  const categoryMap = new Map<string, { revenue: number; quantity: number }>();
  rows.forEach(row => {
    const existing = categoryMap.get(row.category) || { revenue: 0, quantity: 0 };
    categoryMap.set(row.category, {
      revenue: existing.revenue + row.netSales,
      quantity: existing.quantity + row.quantity,
    });
  });
  
  // Group by item
  const itemMap = new Map<string, { revenue: number; quantity: number; category: string }>();
  rows.forEach(row => {
    const key = `${row.itemName}|${row.category}`;
    const existing = itemMap.get(key) || { revenue: 0, quantity: 0, category: row.category };
    itemMap.set(key, {
      revenue: existing.revenue + row.netSales,
      quantity: existing.quantity + row.quantity,
      category: row.category,
    });
  });
  
  // Group by date
  const dailyMap = new Map<string, { revenue: number; quantity: number }>();
  rows.forEach(row => {
    const dateKey = row.date.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey) || { revenue: 0, quantity: 0 };
    dailyMap.set(dateKey, {
      revenue: existing.revenue + row.netSales,
      quantity: existing.quantity + row.quantity,
    });
  });
  
  // Generate top categories
  const topCategories = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      revenue: data.revenue,
      quantity: data.quantity,
      percentage: (data.revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  
  // Generate top items
  const topItems = Array.from(itemMap.entries())
    .map(([key, data]) => {
      const [itemName] = key.split('|');
      return {
        itemName,
        category: data.category,
        revenue: data.revenue,
        quantity: data.quantity,
        percentage: (data.revenue / totalRevenue) * 100,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  
  // Generate daily sales
  const dailySales = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      quantity: data.quantity,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    totalRevenue,
    totalQuantity,
    averageOrderValue: totalRevenue / Math.max(rows.length, 1),
    topCategories,
    topItems,
    dailySales,
  };
}