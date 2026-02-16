'use client';

import { useState, useCallback, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

type PieVariation = {
  name: string;
  totalSold: number;
  avgPerDay: number;
  avgPerDeliveryPeriod: number;
  recommendedDaily: {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
  };
  peakHours: string[];
  peakDays: string[];
};

type TimeAnalysis = {
  hourly: { hour: string; sales: number }[];
  periods: { period: string; sales: number }[];
  dayOfWeek: { day: string; sales: number }[];
};

type AnalysisResult = {
  variations: PieVariation[];
  timeAnalysis: TimeAnalysis;
  totalPiesSold: number;
  totalDays: number;
  dateRange: { start: string; end: string };
};

type StockEntry = {
  [pieName: string]: number;
};

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#f97316'];

// Order schedule: Mon order→Tue delivery (covers Tue-Wed), Wed order→Thu delivery (covers Thu-Mon)
const ORDER_SCHEDULES = {
  monday: { // Order on Monday
    deliveryDay: 'Tuesday',
    coversDAys: ['tuesday', 'wednesday'],
    orderBy: 'Monday EOD'
  },
  wednesday: { // Order on Wednesday
    deliveryDay: 'Thursday', 
    coversDAys: ['thursday', 'friday', 'saturday', 'sunday', 'monday'],
    orderBy: 'Wednesday EOD'
  }
};

export default function PieCalculatorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generalBuffer, setGeneralBuffer] = useState(0);
  const [deliveryBuffer, setDeliveryBuffer] = useState(0);
  const [printMode, setPrintMode] = useState<'full' | 'staff' | 'order'>('full');
  const [dataSource, setDataSource] = useState<'square' | 'csv'>('square');
  const [squareWeeks, setSquareWeeks] = useState(6);
  const [isSquareLoading, setIsSquareLoading] = useState(false);
  const [currentStock, setCurrentStock] = useState<StockEntry>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/orders/analyze-pie-sales', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze pie sales');
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSquareAnalyze = async () => {
    setIsSquareLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/square/pie-analysis?weeks=${squareWeeks}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to analyze pie sales from Square');
      }

      const result = await response.json();
      const data = result.data || result;
      setAnalysis(data);
      // Initialize stock to 0 for all variations
      const initialStock: StockEntry = {};
      data.variations.forEach((v: PieVariation) => {
        initialStock[v.name] = 0;
      });
      setCurrentStock(initialStock);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSquareLoading(false);
    }
  };

  const getDayName = (dayIndex: number): keyof PieVariation['recommendedDaily'] => {
    const days: Array<keyof PieVariation['recommendedDaily']> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayIndex];
  };

  const applyBuffers = useCallback((baseValue: number, isDeliveryDay: boolean): number => {
    let adjusted = baseValue * (1 + generalBuffer / 100);
    if (isDeliveryDay) {
      adjusted = adjusted * (1 + deliveryBuffer / 100);
    }
    return Math.ceil(adjusted);
  }, [generalBuffer, deliveryBuffer]);

  const getAdjustedRecommendations = useCallback((variation: PieVariation) => {
    return {
      sunday: applyBuffers(variation.recommendedDaily.sunday, false),
      monday: applyBuffers(variation.recommendedDaily.monday, false),
      tuesday: applyBuffers(variation.recommendedDaily.tuesday, true),
      wednesday: applyBuffers(variation.recommendedDaily.wednesday, false),
      thursday: applyBuffers(variation.recommendedDaily.thursday, true),
      friday: applyBuffers(variation.recommendedDaily.friday, false),
      saturday: applyBuffers(variation.recommendedDaily.saturday, false),
    };
  }, [applyBuffers]);

  const getTodayRecommendations = useCallback(() => {
    if (!analysis) return [];
    const today = new Date().getDay();
    const dayName = getDayName(today);
    const isDeliveryDay = today === 2 || today === 4;

    return analysis.variations.map(v => ({
      name: v.name,
      quantity: applyBuffers(v.recommendedDaily[dayName], isDeliveryDay),
    }));
  }, [analysis, applyBuffers]);

  const getBoxSize = (pieName: string): number => {
    const name = pieName.toLowerCase();
    if (name.includes('cheese') || name.includes('spinach') || name.includes('energy')) {
      return 16;
    }
    return 12;
  };

  // Get today's day of week (0=Sun, 1=Mon, etc.)
  const today = new Date().getDay();
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today];

  // Determine which order period we're in
  const getActiveOrderPeriod = useCallback(() => {
    // Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
    // If Mon or Tue: we're in "Monday order" period (order Mon for Tue delivery)
    // If Wed, Thu, Fri, Sat, Sun: we're in "Wednesday order" period (order Wed for Thu delivery)
    if (today === 1 || today === 2) {
      return 'monday';
    }
    return 'wednesday';
  }, [today]);

  // Calculate order for a specific delivery
  const calculateOrderForDelivery = useCallback((orderDay: 'monday' | 'wednesday') => {
    if (!analysis) return [];

    const schedule = ORDER_SCHEDULES[orderDay];
    const daysToOrder = schedule.coversDAys as Array<keyof PieVariation['recommendedDaily']>;

    return analysis.variations.map(v => {
      const adjusted = getAdjustedRecommendations(v);
      const totalNeeded = daysToOrder.reduce((sum, day) => sum + adjusted[day], 0);
      const boxSize = getBoxSize(v.name);
      const stock = currentStock[v.name] || 0;
      
      // Calculate what we actually need to order
      const netNeeded = Math.max(0, totalNeeded - stock);
      const boxesNeeded = Math.ceil(netNeeded / boxSize);
      const totalOrdered = boxesNeeded * boxSize;

      return {
        name: v.name,
        totalNeeded,
        currentStock: stock,
        netNeeded,
        boxSize,
        boxesNeeded,
        totalOrdered,
        daysBreakdown: daysToOrder.map(day => ({
          day,
          quantity: adjusted[day]
        }))
      };
    });
  }, [analysis, getAdjustedRecommendations, currentStock]);

  const updateStock = (pieName: string, value: number) => {
    setCurrentStock(prev => ({
      ...prev,
      [pieName]: Math.max(0, value)
    }));
  };

  const handlePrint = () => {
    setPrintMode('full');
    setTimeout(() => window.print(), 100);
  };

  const handlePrintStaffList = () => {
    setPrintMode('staff');
    setTimeout(() => window.print(), 100);
  };

  const handlePrintOrderSheet = () => {
    setPrintMode('order');
    setTimeout(() => window.print(), 100);
  };

  const activeOrderPeriod = getActiveOrderPeriod();

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: A4;
              margin: 0.5cm;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
            .print-header {
              display: block !important;
            }
            .print\\:block {
              display: block !important;
            }
            .container {
              max-width: 100% !important;
              padding: 0 !important;
            }
            .avoid-break {
              page-break-inside: avoid;
            }
            h1 {
              color: #7c3aed !important;
              font-size: 26pt !important;
              font-weight: bold !important;
              margin-bottom: 6pt !important;
              margin-top: 0 !important;
            }
            h2 {
              color: #7c3aed !important;
              font-size: 18pt !important;
              font-weight: bold !important;
              margin-bottom: 4pt !important;
              margin-top: 0 !important;
            }
            .border-b-2 {
              border-bottom: 2pt solid #c4b5fd !important;
            }
            .bg-purple-50 {
              background-color: #f5f3ff !important;
            }
            .bg-pink-50 {
              background-color: #fdf2f8 !important;
            }
            .bg-gradient-to-br, .bg-gradient-to-r {
              background: #f5f3ff !important;
            }
            .border-purple-200 {
              border-color: #c4b5fd !important;
            }
            table {
              font-size: 11pt;
              border-collapse: collapse;
            }
            table th, table td {
              padding: 4pt 6pt !important;
            }
            .chart-container {
              height: 280px !important;
            }
            .shadow {
              box-shadow: none !important;
              border: 1px solid #e5e7eb !important;
            }
            .rounded-lg, .rounded {
              border-radius: 2pt !important;
            }

            /* Staff Print Mode - Clean Daily Checklist */
            .print-staff-mode .print-full-report,
            .print-staff-mode .print-order-sheet {
              display: none !important;
            }
            .print-staff-mode .staff-checklist {
              display: block !important;
            }
            .print-full-mode .staff-checklist,
            .print-full-mode .print-order-sheet {
              display: none !important;
            }
            .print-order-mode .print-full-report,
            .print-order-mode .staff-checklist {
              display: none !important;
            }
            .print-order-mode .print-order-sheet {
              display: block !important;
            }

            /* Staff Checklist Specific Styles */
            .staff-checklist {
              font-family: 'Arial', sans-serif !important;
            }
            .staff-checklist .header {
              text-align: center;
              border-bottom: 2pt solid #7c3aed;
              padding-bottom: 10pt;
              margin-bottom: 12pt;
            }
            .staff-checklist .header .date {
              font-size: 22pt !important;
              color: #1f2937 !important;
              font-weight: bold !important;
            }
            .staff-checklist .section-title {
              font-size: 16pt !important;
              font-weight: bold !important;
              margin: 8pt 0 5pt 0 !important;
              padding: 4pt 0 !important;
              border-bottom: 2pt solid #7c3aed !important;
            }
            .staff-checklist .pie-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 4pt 6pt;
              margin: 2pt 0;
              border: 1pt solid #d1d5db;
              border-radius: 2pt;
              background: #ffffff;
            }
            .staff-checklist .pie-name {
              font-size: 11pt !important;
              font-weight: 500 !important;
              flex: 1;
            }
            .staff-checklist .pie-quantity {
              font-size: 14pt !important;
              font-weight: bold !important;
              color: #7c3aed !important;
              margin: 0 10pt;
              min-width: 35pt;
              text-align: center;
            }
            .staff-checklist .checkbox {
              width: 14pt;
              height: 14pt;
              border: 1.5pt solid #9ca3af;
              border-radius: 2pt;
              flex-shrink: 0;
            }
            .staff-checklist .delivery-badge {
              display: inline-block;
              background: #7c3aed;
              color: white;
              padding: 2pt 6pt;
              border-radius: 3pt;
              font-size: 10pt;
              font-weight: bold;
              margin-left: 6pt;
            }
            .staff-checklist .total-row {
              margin-top: 5pt;
              padding: 5pt 6pt;
              background: #f3f4f6;
              border: 1.5pt solid #9ca3af;
              border-radius: 2pt;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .staff-checklist .total-label {
              font-size: 12pt !important;
              font-weight: bold !important;
            }
            .staff-checklist .total-value {
              font-size: 16pt !important;
              font-weight: bold !important;
              color: #7c3aed !important;
            }
          }
        `
      }} />

      <div className={`container mx-auto p-6 ${printMode === 'staff' ? 'print-staff-mode' : printMode === 'order' ? 'print-order-mode' : 'print-full-mode'}`}>
        {/* Print Header - Only visible when printing */}
        <div className="print-header hidden text-center mb-6">
          <h1 className="text-4xl font-bold text-purple-900">Wild Octave Organics</h1>
        </div>

        {/* Screen Header */}
        <div className="no-print bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/wild-octave-new-logo.png"
                alt="Wild Octave Organics"
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Pie Sales Calculator</h1>
                <p className="text-sm text-gray-600">Byron Bay Gourmet Pies Analysis • {todayName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {analysis && (
                <>
                  <button
                    onClick={handlePrintOrderSheet}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-semibold shadow-sm transition-colors"
                  >
                    📦 Print Order Sheet
                  </button>
                  <button
                    onClick={handlePrintStaffList}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold shadow-sm transition-colors"
                  >
                    ✓ Print Staff Checklist
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-sm transition-colors"
                  >
                    🖨️ Print Full Report
                  </button>
                </>
              )}
              <Link href="/orders">
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  ← Back to Orders
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Order Schedule Info Banner */}
        <div className="no-print bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">📅 Pie Order Schedule</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white rounded p-3 border border-blue-200">
              <span className="font-semibold text-blue-700">Monday Order → Tuesday Delivery</span>
              <p className="text-gray-600 mt-1">Covers: Tuesday, Wednesday</p>
            </div>
            <div className="bg-white rounded p-3 border border-purple-200">
              <span className="font-semibold text-purple-700">Wednesday Order → Thursday Delivery</span>
              <p className="text-gray-600 mt-1">Covers: Thursday, Friday, Saturday, Sunday, Monday</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Current period: <span className="font-semibold">{activeOrderPeriod === 'monday' ? 'Monday order window' : 'Wednesday order window'}</span>
          </p>
        </div>

        {/* Data Source Section */}
        <div className="no-print bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Pie Sales Data</h2>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                onClick={() => setDataSource('square')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  dataSource === 'square'
                    ? 'bg-white text-purple-700 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                ⬛ Square Data
              </button>
              <button
                onClick={() => setDataSource('csv')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  dataSource === 'csv'
                    ? 'bg-white text-purple-700 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📄 CSV Upload
              </button>
            </div>
          </div>

          {dataSource === 'square' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weeks to Analyze</label>
                  <select
                    value={squareWeeks}
                    onChange={(e) => setSquareWeeks(parseInt(e.target.value))}
                    className="block w-full pl-3 pr-10 py-2 text-base bg-white text-gray-900 border border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
                  >
                    <option value="2">2 weeks</option>
                    <option value="4">4 weeks</option>
                    <option value="6">6 weeks</option>
                    <option value="8">8 weeks</option>
                    <option value="12">12 weeks</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSquareAnalyze}
                    disabled={isSquareLoading}
                    className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isSquareLoading ? 'Analyzing...' : 'Analyze Square Data'}
                  </button>
                </div>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                <p className="text-sm text-purple-800 font-medium">💡 Pulls pie/pastry sales directly from Square POS synced data</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                <button
                  onClick={handleAnalyze}
                  disabled={!file || loading}
                  className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {loading ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Upload Square &quot;Item Sales Detail&quot; CSV export for Byron Bay Gourmet Pies
              </p>
            </div>
          )}
          {error && <p className="text-red-600 mt-2">{error}</p>}

          {analysis && (
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-700">Buffer Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">General Buffer (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={generalBuffer}
                    onChange={(e) => setGeneralBuffer(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Apply to all days (currently {generalBuffer}%)</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Delivery Day Buffer (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={deliveryBuffer}
                    onChange={(e) => setDeliveryBuffer(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Extra buffer for Tue/Thu (currently {deliveryBuffer}%)</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {analysis && (
          <>
            {/* Current Stock & Order Calculator - Main Feature */}
            <div className="bg-white rounded-lg shadow p-6 mb-6 border-2 border-green-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-green-900 border-b-2 border-green-200 pb-2">📦 Order Calculator with Stock</h2>
                <span className="text-sm text-gray-500">
                  {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Enter your current stock below. The calculator will show exactly what to order.
                <span className="ml-2 text-green-700 font-medium">Box sizes: Cheese/Spinach/Energy = 16 | Others = 12</span>
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monday Order → Tuesday Delivery */}
                <div className={`border-2 rounded-lg p-4 ${activeOrderPeriod === 'monday' ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300' : 'border-blue-200 bg-blue-50/50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-blue-900">🚚 Monday Order</h3>
                      <p className="text-sm text-blue-700">→ Tuesday Delivery</p>
                    </div>
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded font-medium">
                      Covers: Tue, Wed
                    </span>
                  </div>
                  
                  {activeOrderPeriod === 'monday' && (
                    <div className="mb-3 p-2 bg-blue-200 rounded text-sm font-medium text-blue-900">
                      ⚡ Active ordering window
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600 px-2">
                      <div className="col-span-4">Item</div>
                      <div className="col-span-2 text-center">Need</div>
                      <div className="col-span-2 text-center">Stock</div>
                      <div className="col-span-2 text-center">Net</div>
                      <div className="col-span-2 text-center">Order</div>
                    </div>
                    
                    {calculateOrderForDelivery('monday').map((item) => (
                      <div key={item.name} className="bg-white rounded p-2 border border-blue-200">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4">
                            <span className="font-medium text-sm text-gray-900 truncate block">{item.name}</span>
                            <span className="text-xs text-gray-500">Box of {item.boxSize}</span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-sm font-medium">{item.totalNeeded}</span>
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="0"
                              value={currentStock[item.name] || 0}
                              onChange={(e) => updateStock(item.name, parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-center text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={`text-sm font-medium ${item.netNeeded > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              {item.netNeeded}
                            </span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={`text-lg font-bold ${item.boxesNeeded > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                              {item.boxesNeeded > 0 ? `${item.boxesNeeded} box` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t-2 border-blue-300 bg-blue-100 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-900">Total Boxes to Order:</span>
                      <span className="text-2xl font-bold text-blue-900">
                        {calculateOrderForDelivery('monday').reduce((sum, item) => sum + item.boxesNeeded, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-700 mt-1">
                      <span>Total Pies:</span>
                      <span className="font-semibold">
                        {calculateOrderForDelivery('monday').reduce((sum, item) => sum + item.totalOrdered, 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Wednesday Order → Thursday Delivery */}
                <div className={`border-2 rounded-lg p-4 ${activeOrderPeriod === 'wednesday' ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-300' : 'border-purple-200 bg-purple-50/50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-purple-900">🚚 Wednesday Order</h3>
                      <p className="text-sm text-purple-700">→ Thursday Delivery</p>
                    </div>
                    <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded font-medium">
                      Covers: Thu-Mon
                    </span>
                  </div>

                  {activeOrderPeriod === 'wednesday' && (
                    <div className="mb-3 p-2 bg-purple-200 rounded text-sm font-medium text-purple-900">
                      ⚡ Active ordering window
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600 px-2">
                      <div className="col-span-4">Item</div>
                      <div className="col-span-2 text-center">Need</div>
                      <div className="col-span-2 text-center">Stock</div>
                      <div className="col-span-2 text-center">Net</div>
                      <div className="col-span-2 text-center">Order</div>
                    </div>

                    {calculateOrderForDelivery('wednesday').map((item) => (
                      <div key={item.name} className="bg-white rounded p-2 border border-purple-200">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4">
                            <span className="font-medium text-sm text-gray-900 truncate block">{item.name}</span>
                            <span className="text-xs text-gray-500">Box of {item.boxSize}</span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-sm font-medium">{item.totalNeeded}</span>
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="0"
                              value={currentStock[item.name] || 0}
                              onChange={(e) => updateStock(item.name, parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-center text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={`text-sm font-medium ${item.netNeeded > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              {item.netNeeded}
                            </span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={`text-lg font-bold ${item.boxesNeeded > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                              {item.boxesNeeded > 0 ? `${item.boxesNeeded} box` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t-2 border-purple-300 bg-purple-100 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-900">Total Boxes to Order:</span>
                      <span className="text-2xl font-bold text-purple-900">
                        {calculateOrderForDelivery('wednesday').reduce((sum, item) => sum + item.boxesNeeded, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-700 mt-1">
                      <span>Total Pies:</span>
                      <span className="font-semibold">
                        {calculateOrderForDelivery('wednesday').reduce((sum, item) => sum + item.totalOrdered, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="print-full-report">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 avoid-break">
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-600">Total Pies Sold</p>
                  <p className="text-2xl font-bold text-purple-600">{analysis.totalPiesSold}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-600">Days Analyzed</p>
                  <p className="text-2xl font-bold text-purple-600">{analysis.totalDays}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-600">Avg Pies/Day</p>
                  <p className="text-2xl font-bold text-purple-600">{(analysis.totalPiesSold / analysis.totalDays).toFixed(1)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-600">Date Range</p>
                  <p className="text-sm font-semibold">{analysis.dateRange.start}</p>
                  <p className="text-sm font-semibold">{analysis.dateRange.end}</p>
                </div>
              </div>

              {/* Key Insights Summary */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow p-6 mb-6 border-l-4 border-purple-500 avoid-break key-insights">
                <h2 className="text-lg font-bold mb-3 text-purple-900">📊 Key Insights</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-purple-800 mb-1">Top 3 Best Sellers:</p>
                    <ul className="space-y-1">
                      {[...analysis.variations]
                        .sort((a, b) => b.totalSold - a.totalSold)
                        .slice(0, 3)
                        .map((v, idx) => (
                          <li key={v.name} className="text-gray-700">
                            {idx + 1}. <span className="font-medium">{v.name}</span> ({v.totalSold} sold, {v.avgPerDay.toFixed(1)}/day)
                          </li>
                        ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-purple-800 mb-1">Busiest Days:</p>
                    <ul className="space-y-1">
                      {[...analysis.timeAnalysis.dayOfWeek]
                        .sort((a, b) => b.sales - a.sales)
                        .slice(0, 3)
                        .map((d, idx) => {
                          const occurrences = Math.floor(analysis.totalDays / 7);
                          const avgPerOccurrence = occurrences > 0 ? (d.sales / occurrences).toFixed(1) : d.sales.toFixed(1);
                          return (
                            <li key={d.day} className="text-gray-700">
                              {idx + 1}. <span className="font-medium">{d.day}</span> ({d.sales} sold, {avgPerOccurrence}/day)
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-purple-800 mb-1">Order Schedule:</p>
                    <ul className="space-y-1 text-gray-700">
                      <li>📅 <span className="font-medium">Mon</span> order → Tue delivery (Tue-Wed)</li>
                      <li>📅 <span className="font-medium">Wed</span> order → Thu delivery (Thu-Mon)</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-purple-200">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-purple-800">Daily Average:</span> {(analysis.totalPiesSold / analysis.totalDays).toFixed(1)} pies/day
                    <span className="mx-2">•</span>
                    <span className="font-semibold text-purple-800">Weekly Average:</span> {((analysis.totalPiesSold / analysis.totalDays) * 7).toFixed(0)} pies/week
                    <span className="mx-2">•</span>
                    <span className="font-semibold text-purple-800">Variety Count:</span> {analysis.variations.length} pie types
                  </p>
                </div>
              </div>

              {/* Daily Cooking Schedule */}
              <div className="bg-white rounded-lg shadow p-6 mb-6 avoid-break daily-schedule">
                <h2 className="text-xl font-semibold mb-4 border-b-2 border-purple-200 pb-2">Daily Cooking Schedule</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                    const dayKey = day.toLowerCase() as keyof PieVariation['recommendedDaily'];
                    const isDeliveryDay = day === 'Tuesday' || day === 'Thursday';

                    const dailyItems = analysis.variations
                      .map(v => {
                        const adjusted = getAdjustedRecommendations(v);
                        return { name: v.name, quantity: adjusted[dayKey] };
                      })
                      .filter(item => item.quantity > 0)
                      .sort((a, b) => b.quantity - a.quantity);

                    const totalForDay = dailyItems.reduce((sum, item) => sum + item.quantity, 0);

                    return (
                      <div key={day} className={`day-card border-2 rounded-lg p-4 ${isDeliveryDay ? 'border-purple-300 bg-purple-50' : 'border-gray-200'}`}>
                        <h3 className={`font-bold text-lg mb-2 ${isDeliveryDay ? 'text-purple-900' : 'text-gray-900'}`}>
                          {day} {isDeliveryDay && '🚚 (Delivery Day)'}
                        </h3>
                        <ul className="space-y-1">
                          {dailyItems.map((item) => (
                            <li key={item.name} className="flex justify-between items-center py-0.5 border-b border-gray-200 last:border-0">
                              <span className="text-sm text-gray-700 flex-1">{item.name}</span>
                              <span className={`font-semibold text-lg ml-2 ${isDeliveryDay ? 'text-purple-600' : 'text-gray-900'}`}>
                                {item.quantity}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className={`total-section mt-2 pt-2 border-t-2 ${isDeliveryDay ? 'border-purple-300' : 'border-gray-300'}`}>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Total Pies:</span>
                            <span className={`font-bold text-xl ${isDeliveryDay ? 'text-purple-900' : 'text-gray-900'}`}>
                              {Math.ceil(totalForDay)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weekly Recommendations Table */}
              <div className="bg-white rounded-lg shadow p-6 mb-6 avoid-break">
                <h2 className="text-xl font-semibold mb-4 border-b-2 border-purple-200 pb-2">Weekly Recommendations by Variation</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 font-semibold">Variation</th>
                        <th className="text-right py-2 px-4 font-semibold">Total Sold</th>
                        <th className="text-right py-2 px-4 font-semibold">Avg/Day</th>
                        <th className="text-right py-2 px-4 font-semibold bg-purple-50">Mon</th>
                        <th className="text-right py-2 px-4 font-semibold bg-purple-50">Tue</th>
                        <th className="text-right py-2 px-4 font-semibold bg-purple-50">Wed</th>
                        <th className="text-right py-2 px-4 font-semibold bg-purple-50">Thu</th>
                        <th className="text-right py-2 px-4 font-semibold bg-purple-50">Fri</th>
                        <th className="text-right py-2 px-4 font-semibold bg-pink-50">Sat</th>
                        <th className="text-right py-2 px-4 font-semibold bg-pink-50">Sun</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.variations.map((variation, idx) => {
                        const adjusted = getAdjustedRecommendations(variation);
                        return (
                          <tr key={variation.name} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                            <td className="py-2 px-4 font-medium">{variation.name}</td>
                            <td className="py-2 px-4 text-right">{variation.totalSold}</td>
                            <td className="py-2 px-4 text-right">{variation.avgPerDay.toFixed(1)}</td>
                            <td className="py-2 px-4 text-right bg-purple-50">{adjusted.monday}</td>
                            <td className="py-2 px-4 text-right bg-purple-50 font-semibold">{adjusted.tuesday}</td>
                            <td className="py-2 px-4 text-right bg-purple-50">{adjusted.wednesday}</td>
                            <td className="py-2 px-4 text-right bg-purple-50 font-semibold">{adjusted.thursday}</td>
                            <td className="py-2 px-4 text-right bg-purple-50">{adjusted.friday}</td>
                            <td className="py-2 px-4 text-right bg-pink-50">{adjusted.saturday}</td>
                            <td className="py-2 px-4 text-right bg-pink-50">{adjusted.sunday}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Day of Week Pattern */}
              <div className="bg-white rounded-lg shadow p-6 mb-2 avoid-break">
                <h2 className="text-xl font-semibold mb-4 border-b-2 border-purple-200 pb-2">Day of Week Pattern (Average per Occurrence)</h2>
                <ResponsiveContainer width="100%" height={300} className="chart-container">
                  <LineChart data={analysis.timeAnalysis.dayOfWeek.map(item => ({
                    day: item.day,
                    avgSales: Number((item.sales / (analysis.totalDays / 7)).toFixed(1))
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="avgSales" stroke="#8b5cf6" strokeWidth={2} name="Avg Pies per Occurrence" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Staff Checklist - Only visible when printing in staff mode */}
            <div className="staff-checklist hidden">
              <div className="header">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10pt' }}>
                  <img
                    src="/wild-octave-new-logo.png"
                    alt="Wild Octave Organics"
                    style={{ height: '60px', width: 'auto' }}
                  />
                </div>
                <div className="date">
                  Weekly Pie Prep Checklist
                </div>
              </div>

              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                const dayKey = day.toLowerCase() as keyof PieVariation['recommendedDaily'];
                const isDeliveryDay = day === 'Tuesday' || day === 'Thursday';

                const dailyItems = analysis.variations
                  .map(v => {
                    const adjusted = getAdjustedRecommendations(v);
                    return { name: v.name, quantity: adjusted[dayKey] };
                  })
                  .filter(item => item.quantity > 0)
                  .sort((a, b) => b.quantity - a.quantity);

                const totalForDay = dailyItems.reduce((sum, item) => sum + item.quantity, 0);

                return (
                  <div key={day} style={{ marginBottom: '12pt', pageBreakInside: 'avoid' }}>
                    <div className="section-title" style={{ marginTop: day === 'Monday' ? '5pt' : '8pt' }}>
                      {day}
                      {isDeliveryDay && (
                        <span className="delivery-badge">🚚 DELIVERY DAY</span>
                      )}
                    </div>

                    <div>
                      {dailyItems.map((item) => (
                        <div key={item.name} className="pie-item">
                          <div className="pie-name">{item.name}</div>
                          <div className="pie-quantity">{item.quantity}</div>
                          <div className="checkbox"></div>
                        </div>
                      ))}
                    </div>

                    <div className="total-row">
                      <div className="total-label">Total Pies:</div>
                      <div className="total-value">
                        {Math.ceil(totalForDay)}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="footer" style={{ marginTop: '15pt', paddingTop: '8pt', borderTop: '1pt solid #d1d5db', textAlign: 'center', fontSize: '9pt', color: '#6b7280' }}>
                <p>Generated: {new Date().toLocaleString('en-AU')} | Buffers: General {generalBuffer}%, Delivery +{deliveryBuffer}%</p>
                <p>Delivery Schedule: Tuesday & Thursday | Box sizes: Cheese/Spinach/Energy Rolls = 16 | All others = 12</p>
              </div>
            </div>

            {/* Order Sheet - Only visible when printing in order mode */}
            <div className="print-order-sheet hidden">
              <div style={{ textAlign: 'center', borderBottom: '2pt solid #7c3aed', paddingBottom: '10pt', marginBottom: '20pt' }}>
                <img
                  src="/wild-octave-new-logo.png"
                  alt="Wild Octave Organics"
                  style={{ height: '60px', width: 'auto', margin: '0 auto 8pt auto', display: 'block' }}
                />
                <div style={{ fontSize: '22pt', fontWeight: 'bold', color: '#1f2937' }}>
                  Pie Order Sheet
                </div>
                <div style={{ fontSize: '12pt', color: '#6b7280' }}>
                  {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              {/* Monday Order */}
              <div style={{ marginBottom: '20pt' }}>
                <h3 style={{ fontSize: '16pt', fontWeight: 'bold', color: '#1e40af', borderBottom: '2pt solid #3b82f6', paddingBottom: '4pt', marginBottom: '10pt' }}>
                  📦 Monday Order → Tuesday Delivery (Tue-Wed)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#dbeafe' }}>
                      <th style={{ textAlign: 'left', padding: '6pt', border: '1pt solid #93c5fd' }}>Item</th>
                      <th style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #93c5fd', width: '60pt' }}>Need</th>
                      <th style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #93c5fd', width: '60pt' }}>Stock</th>
                      <th style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #93c5fd', width: '70pt' }}>Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculateOrderForDelivery('monday').filter(i => i.boxesNeeded > 0).map((item, idx) => (
                      <tr key={item.name} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f0f9ff' }}>
                        <td style={{ padding: '6pt', border: '1pt solid #93c5fd' }}>
                          {item.name} <span style={{ color: '#6b7280', fontSize: '9pt' }}>(box of {item.boxSize})</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #93c5fd' }}>{item.totalNeeded}</td>
                        <td style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #93c5fd' }}>{item.currentStock}</td>
                        <td style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #93c5fd', fontWeight: 'bold', color: '#1e40af', fontSize: '14pt' }}>
                          {item.boxesNeeded} box{item.boxesNeeded !== 1 ? 'es' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#bfdbfe', fontWeight: 'bold' }}>
                      <td style={{ padding: '8pt', border: '1pt solid #93c5fd' }} colSpan={3}>TOTAL</td>
                      <td style={{ textAlign: 'center', padding: '8pt', border: '1pt solid #93c5fd', fontSize: '16pt', color: '#1e40af' }}>
                        {calculateOrderForDelivery('monday').reduce((sum, item) => sum + item.boxesNeeded, 0)} boxes
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Wednesday Order */}
              <div>
                <h3 style={{ fontSize: '16pt', fontWeight: 'bold', color: '#7c3aed', borderBottom: '2pt solid #a78bfa', paddingBottom: '4pt', marginBottom: '10pt' }}>
                  📦 Wednesday Order → Thursday Delivery (Thu-Mon)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#ede9fe' }}>
                      <th style={{ textAlign: 'left', padding: '6pt', border: '1pt solid #c4b5fd' }}>Item</th>
                      <th style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #c4b5fd', width: '60pt' }}>Need</th>
                      <th style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #c4b5fd', width: '60pt' }}>Stock</th>
                      <th style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #c4b5fd', width: '70pt' }}>Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculateOrderForDelivery('wednesday').filter(i => i.boxesNeeded > 0).map((item, idx) => (
                      <tr key={item.name} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#faf5ff' }}>
                        <td style={{ padding: '6pt', border: '1pt solid #c4b5fd' }}>
                          {item.name} <span style={{ color: '#6b7280', fontSize: '9pt' }}>(box of {item.boxSize})</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #c4b5fd' }}>{item.totalNeeded}</td>
                        <td style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #c4b5fd' }}>{item.currentStock}</td>
                        <td style={{ textAlign: 'center', padding: '6pt', border: '1pt solid #c4b5fd', fontWeight: 'bold', color: '#7c3aed', fontSize: '14pt' }}>
                          {item.boxesNeeded} box{item.boxesNeeded !== 1 ? 'es' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#ddd6fe', fontWeight: 'bold' }}>
                      <td style={{ padding: '8pt', border: '1pt solid #c4b5fd' }} colSpan={3}>TOTAL</td>
                      <td style={{ textAlign: 'center', padding: '8pt', border: '1pt solid #c4b5fd', fontSize: '16pt', color: '#7c3aed' }}>
                        {calculateOrderForDelivery('wednesday').reduce((sum, item) => sum + item.boxesNeeded, 0)} boxes
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div style={{ marginTop: '20pt', paddingTop: '8pt', borderTop: '1pt solid #d1d5db', textAlign: 'center', fontSize: '9pt', color: '#6b7280' }}>
                <p>Generated: {new Date().toLocaleString('en-AU')} | Buffers: General {generalBuffer}%, Delivery +{deliveryBuffer}%</p>
              </div>
            </div>

            {/* Print-only footer for full report */}
            <div className="print-full-report hidden print:block mt-6 pt-4 border-t text-center text-base text-gray-600">
              <p className="font-semibold">Generated by Wild Octave Organics Pie Calculator | {new Date().toLocaleString()}</p>
              <p className="mt-1">
                Delivery Schedule: Tuesday & Thursday |
                Buffers: General {generalBuffer}%, Delivery Day +{deliveryBuffer}%
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
