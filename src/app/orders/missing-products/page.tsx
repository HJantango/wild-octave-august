'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Papa from 'papaparse';

interface SalesSummaryItem {
  itemName: string;
  vendorCode: string;
  category: string;
  unitsSold: number;
  grossSales: number;
  netSales: number;
  avgPrice: number;
}

interface AnalyzedProduct extends SalesSummaryItem {
  recommendedOrderQty: number;
  weeklySales: number;
  inDatabase: boolean;
  matchType?: 'sku' | 'name' | 'none';
  totalReceived: number;
}

export default function MissingProductsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analyzedProducts, setAnalyzedProducts] = useState<AnalyzedProduct[]>([]);
  const [weeksCovered, setWeeksCovered] = useState(0);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const analyzeSalesReport = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const text = await file.text();

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const salesData: SalesSummaryItem[] = results.data.map((row: any) => ({
              itemName: row['Item Name'] || '',
              vendorCode: row['Vendor Code'] || '',
              category: row['Category'] || '',
              unitsSold: parseInt(row['Units Sold'] || '0', 10),
              grossSales: parseFloat(row['Gross Sales']?.replace(/[$,]/g, '') || '0'),
              netSales: parseFloat(row['Net Sales']?.replace(/[$,]/g, '') || '0'),
              avgPrice: 0
            })).filter(item => item.itemName && item.unitsSold > 0);

            // Calculate average price
            salesData.forEach(item => {
              item.avgPrice = item.unitsSold > 0 ? item.netSales / item.unitsSold : 0;
            });

            // Calculate actual date range
            // Square POS installed on May 8, 2025
            const startDate = new Date('2025-05-08');
            const endDate = new Date(); // Today

            // Calculate weeks between start and end date
            const daysBetween = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const weeks = Math.max(1, daysBetween / 7); // At least 1 week

            setWeeksCovered(parseFloat(weeks.toFixed(1)));
            setDateRange({
              start: startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
              end: endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
            });

            // Fetch items from database to check matching
            const response = await fetch('/api/items?limit=10000'); // Get all items
            if (!response.ok) {
              throw new Error(`Failed to fetch items from database: ${response.status}`);
            }
            const result = await response.json();
            const dbItems = result.data.data; // Access nested data array
            console.log('Fetched database items:', dbItems.length, 'items');
            console.log('Processing sales data:', salesData.length, 'items');

            // Fetch invoice line items to get total received quantities
            const invoicesResponse = await fetch('/api/invoices?limit=10000&status=RECEIVED');
            let invoiceLineItems: any[] = [];
            if (invoicesResponse.ok) {
              const invoicesResult = await invoicesResponse.json();
              const invoices = invoicesResult.data?.data || invoicesResult.invoices || [];

              // Flatten all line items from all received invoices
              invoiceLineItems = invoices.flatMap((invoice: any) =>
                (invoice.lineItems || []).map((lineItem: any) => ({
                  ...lineItem,
                  invoiceId: invoice.id
                }))
              );
              console.log('Fetched invoice line items:', invoiceLineItems.length, 'items');
            }

            // Analyze ALL products with their sales data
            const analyzed: AnalyzedProduct[] = salesData
              .map(item => {
                const weeklySales = item.unitsSold / weeks;
                const recommendedOrderQty = Math.ceil(weeklySales * 2); // 2 weeks worth

                // Check if product is in database
                const matchBySKU = item.vendorCode && dbItems.some((dbItem: any) =>
                  dbItem.sku && dbItem.sku.toLowerCase() === item.vendorCode.toLowerCase()
                );
                const matchByName = dbItems.some((dbItem: any) =>
                  dbItem.name && item.itemName &&
                  (dbItem.name.toLowerCase().includes(item.itemName.toLowerCase()) ||
                  item.itemName.toLowerCase().includes(dbItem.name?.toLowerCase() || ''))
                );

                let matchType: 'sku' | 'name' | 'none' = 'none';
                if (matchBySKU) matchType = 'sku';
                else if (matchByName) matchType = 'name';

                // Calculate total received from invoice line items
                const totalReceived = invoiceLineItems.reduce((sum, lineItem) => {
                  // Match by item name (case-insensitive contains)
                  const nameMatch = lineItem.name && item.itemName &&
                    (lineItem.name.toLowerCase().includes(item.itemName.toLowerCase()) ||
                    item.itemName.toLowerCase().includes(lineItem.name.toLowerCase()));

                  // Match by vendor code (SKU) if available
                  const skuMatch = item.vendorCode && lineItem.vendorCode &&
                    lineItem.vendorCode.toLowerCase() === item.vendorCode.toLowerCase();

                  if (nameMatch || skuMatch) {
                    return sum + (parseFloat(lineItem.quantity) || 0);
                  }
                  return sum;
                }, 0);

                return {
                  ...item,
                  weeklySales,
                  recommendedOrderQty,
                  inDatabase: matchBySKU || matchByName,
                  matchType,
                  totalReceived
                };
              })
              .sort((a, b) => b.unitsSold - a.unitsSold); // Sort by total units sold

            setAnalyzedProducts(analyzed);
            setIsProcessing(false);
          } catch (err) {
            console.error('Error processing sales data:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(`Failed to process sales data: ${errorMessage}`);
            setIsProcessing(false);
          }
        },
        error: (err) => {
          console.error('Parse error:', err);
          setError('Failed to parse CSV file. Please check the file format.');
          setIsProcessing(false);
        }
      });
    } catch (err) {
      console.error('File reading error:', err);
      setError('Failed to read file. Please try again.');
      setIsProcessing(false);
    }
  };

  const exportToCSV = () => {
    if (analyzedProducts.length === 0) return;

    const headers = ['Item Name', 'Vendor Code', 'Category', 'Total Units Sold', 'Total Received', 'Weekly Avg', 'Net Sales', 'Avg Price', 'Recommended Order Qty', 'In Database'];
    const rows = analyzedProducts.map(item => [
      item.itemName,
      item.vendorCode || 'N/A',
      item.category,
      item.unitsSold,
      item.totalReceived,
      item.weeklySales.toFixed(2),
      `$${item.netSales.toFixed(2)}`,
      `$${item.avgPrice.toFixed(2)}`,
      item.recommendedOrderQty,
      item.inDatabase ? 'Yes' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-summary-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6">
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .page-container { max-width: 100% !important; padding: 0.3cm !important; }
          .container { padding: 0.3cm !important; }

          /* Compact title */
          h1 { font-size: 14pt !important; margin-bottom: 0.2cm !important; margin-top: 0 !important; }
          h2 { font-size: 11pt !important; margin: 0 !important; }

          /* Very compact table */
          table {
            font-size: 7pt !important;
            page-break-inside: auto !important;
            width: 100% !important;
          }
          thead th {
            padding: 0.1cm 0.08cm !important;
            font-size: 7pt !important;
            line-height: 1.1 !important;
          }
          tbody td {
            padding: 0.08cm !important;
            font-size: 7pt !important;
            line-height: 1.2 !important;
          }
          tfoot td {
            padding: 0.1cm 0.08cm !important;
            font-size: 7pt !important;
          }
          tr { page-break-inside: avoid !important; page-break-after: auto !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }

          /* Compact cards */
          .print-card {
            border: 1px solid #ddd !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            margin-bottom: 0.2cm !important;
          }
          .print-card > div { padding: 0.15cm !important; }
          .print-card h3 { display: none !important; }
          .print-card p { display: none !important; }

          /* Compact date banner */
          .date-banner {
            background: #f3e8ff !important;
            border: 1px solid #c084fc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin-bottom: 0.2cm !important;
            padding: 0.15cm !important;
          }
          .date-banner > div { padding: 0.15cm !important; }
          .date-banner div { font-size: 8pt !important; margin: 0 !important; }

          /* Compact summary cards */
          .summary-cards {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 0.15cm !important;
            margin-bottom: 0.2cm !important;
          }
          .summary-cards .text-sm { font-size: 7pt !important; }
          .summary-cards .text-3xl { font-size: 12pt !important; }
          .summary-cards > div > div { padding: 0.2cm !important; }
        }
      `}</style>

      <div className="mb-6 no-print">
        <h1 className="text-3xl font-bold mb-2">Sales Summary Analysis</h1>
        <p className="text-gray-600">
          Upload a Square Sales Summary report to analyze sales data and get order recommendations for products regardless of vendor assignment.
        </p>
      </div>

      <h1 className="text-2xl font-bold mb-4 text-center hidden print:block">
        Sales Summary Analysis
      </h1>

      {/* Upload Section */}
      <Card className="mb-6 no-print">
        <CardHeader>
          <CardTitle>Upload Square Sales Summary</CardTitle>
          <CardDescription>
            Upload an "Item Sales Summary" CSV export from Square POS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">
                Select CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>
            <Button
              onClick={analyzeSalesReport}
              disabled={!file || isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? 'Analyzing...' : 'Analyze Report'}
            </Button>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {analyzedProducts.length > 0 && (
        <>
          {/* Date Range Banner */}
          {dateRange && (
            <Card className="mb-6 border-2 border-purple-200 bg-purple-50 date-banner">
              <CardContent className="py-4">
                <div className="text-center">
                  <div className="text-sm font-semibold text-purple-800 mb-1">Analysis Period</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {dateRange.start} → {dateRange.end}
                  </div>
                  <div className="text-sm text-purple-700 mt-1">
                    {weeksCovered} weeks of sales data
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 summary-cards">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Total Products</div>
                <div className="text-3xl font-bold text-blue-600">{analyzedProducts.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">In Database</div>
                <div className="text-3xl font-bold text-green-600">
                  {analyzedProducts.filter(p => p.inDatabase).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Total Sales</div>
                <div className="text-3xl font-bold text-green-600">
                  ${analyzedProducts.reduce((sum, item) => sum + item.netSales, 0).toFixed(0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Export and Print Buttons */}
          <div className="mb-4 flex justify-end gap-2 no-print">
            <Button onClick={() => window.print()} variant="outline">
              🖨️ Print
            </Button>
            <Button onClick={exportToCSV} variant="outline">
              📥 Export to CSV
            </Button>
          </div>

          {/* Products Table */}
          <Card className="print-card">
            <CardHeader>
              <CardTitle>Sales Analysis Details</CardTitle>
              <CardDescription>
                All products from your sales report with order recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-center p-3 font-semibold">Status</th>
                      <th className="text-left p-3 font-semibold">Item Name</th>
                      <th className="text-left p-3 font-semibold">Vendor Code</th>
                      <th className="text-left p-3 font-semibold">Category</th>
                      <th className="text-right p-3 font-semibold">Total Sold</th>
                      <th className="text-right p-3 font-semibold bg-green-50">Total Received</th>
                      <th className="text-right p-3 font-semibold">Weekly Avg</th>
                      <th className="text-right p-3 font-semibold">Net Sales</th>
                      <th className="text-right p-3 font-semibold">Avg Price</th>
                      <th className="text-right p-3 font-semibold bg-blue-50">Rec. Order Qty<br/><span className="text-xs font-normal">(2 weeks)</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyzedProducts.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-center">
                          {item.inDatabase ? (
                            <span className="text-green-600 font-bold" title="Found in database">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold" title="Not in database">✗</span>
                          )}
                        </td>
                        <td className="p-3 font-medium">{item.itemName}</td>
                        <td className="p-3 text-gray-600">{item.vendorCode || 'N/A'}</td>
                        <td className="p-3 text-gray-600">{item.category}</td>
                        <td className="p-3 text-right font-semibold">{item.unitsSold}</td>
                        <td className="p-3 text-right font-semibold text-green-700 bg-green-50">{item.totalReceived}</td>
                        <td className="p-3 text-right text-blue-600">{item.weeklySales.toFixed(1)}</td>
                        <td className="p-3 text-right text-green-600">${item.netSales.toFixed(2)}</td>
                        <td className="p-3 text-right">${item.avgPrice.toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-blue-700 bg-blue-50">{item.recommendedOrderQty}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td className="p-3"></td>
                      <td className="p-3" colSpan={3}>TOTALS</td>
                      <td className="p-3 text-right">{analyzedProducts.reduce((sum, item) => sum + item.unitsSold, 0)}</td>
                      <td className="p-3 text-right text-green-700 bg-green-50">
                        {analyzedProducts.reduce((sum, item) => sum + item.totalReceived, 0)}
                      </td>
                      <td className="p-3 text-right">
                        {(analyzedProducts.reduce((sum, item) => sum + item.weeklySales, 0)).toFixed(1)}
                      </td>
                      <td className="p-3 text-right text-green-600">
                        ${analyzedProducts.reduce((sum, item) => sum + item.netSales, 0).toFixed(2)}
                      </td>
                      <td className="p-3"></td>
                      <td className="p-3 text-right text-blue-700">
                        {analyzedProducts.reduce((sum, item) => sum + item.recommendedOrderQty, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg no-print">
            <h3 className="font-semibold text-blue-900 mb-2">💡 How to use this analysis:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>✓ (Green checkmark)</strong>: Product is in your database and may already be on a vendor list</li>
              <li>• <strong>✗ (Red X)</strong>: Product not found in your database - may need to be added or assigned to a vendor</li>
              <li>• <strong>Weekly Avg</strong>: Average units sold per week over the analysis period</li>
              <li>• <strong>Rec. Order Qty</strong>: Suggested order quantity (2 weeks worth of sales)</li>
              <li>• Use this to decide whether to reorder products that are assigned to different vendors</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
