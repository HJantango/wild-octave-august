'use client';

import { useState, useCallback } from 'react';
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

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#f97316'];

export default function PieCalculatorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generalBuffer, setGeneralBuffer] = useState(0); // % buffer for all days
  const [deliveryBuffer, setDeliveryBuffer] = useState(0); // Additional % buffer for delivery days
  const [printMode, setPrintMode] = useState<'full' | 'staff'>('full'); // Control what to print

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

  const getDayName = (dayIndex: number): keyof PieVariation['recommendedDaily'] => {
    const days: Array<keyof PieVariation['recommendedDaily']> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayIndex];
  };

  const applyBuffers = useCallback((baseValue: number, isDeliveryDay: boolean): number => {
    let adjusted = baseValue * (1 + generalBuffer / 100);
    if (isDeliveryDay) {
      adjusted = adjusted * (1 + deliveryBuffer / 100);
    }
    // Always round up (ceil) for practical ordering
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
    const isDeliveryDay = today === 2 || today === 4; // Tuesday or Thursday

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

  const calculateOrderForDelivery = useCallback((deliveryDay: 'tuesday' | 'thursday') => {
    if (!analysis) return [];

    // Tuesday delivery covers: Tue, Wed (2 days)
    // Thursday delivery covers: Thu, Fri, Sat, Sun, Mon (5 days)
    const daysToOrder: Array<keyof PieVariation['recommendedDaily']> =
      deliveryDay === 'tuesday'
        ? ['tuesday', 'wednesday']
        : ['thursday', 'friday', 'saturday', 'sunday', 'monday'];

    return analysis.variations.map(v => {
      const adjusted = getAdjustedRecommendations(v);

      // Sum up all pies needed for the days between deliveries
      const totalNeeded = daysToOrder.reduce((sum, day) => sum + adjusted[day], 0);

      // Get box size for this pie type
      const boxSize = getBoxSize(v.name);

      // Calculate number of boxes (round up)
      const boxesNeeded = Math.ceil(totalNeeded / boxSize);

      // Calculate total pies ordered (boxes * box size)
      const totalOrdered = boxesNeeded * boxSize;

      return {
        name: v.name,
        totalNeeded: Math.ceil(totalNeeded),
        boxSize,
        boxesNeeded,
        totalOrdered,
        daysBreakdown: daysToOrder.map(day => ({
          day,
          quantity: adjusted[day]
        }))
      };
    });
  }, [analysis, getAdjustedRecommendations]);

  const handlePrint = () => {
    setPrintMode('full');
    setTimeout(() => window.print(), 100);
  };

  const handlePrintStaffList = () => {
    setPrintMode('staff');
    setTimeout(() => window.print(), 100);
  };

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
            .gap-4, .gap-6 {
              gap: 4pt !important;
            }
            .mb-6, .mb-4, .mb-2 {
              margin-bottom: 4pt !important;
            }
            .mt-6, .mt-4 {
              margin-top: 4pt !important;
            }
            .p-6, .p-4 {
              padding: 6pt !important;
            }
            .text-purple-600, .text-purple-700, .text-purple-900 {
              color: #7c3aed !important;
            }
            .border-purple-300 {
              border-color: #d8b4fe !important;
            }
            .border-t-2 {
              border-top-width: 1pt !important;
            }
            .border-l-4 {
              border-left-width: 2pt !important;
            }
            .last\\:border-0:last-child {
              border: none !important;
            }
            .daily-schedule h3 {
              font-size: 14pt !important;
              font-weight: bold !important;
              margin-bottom: 3pt !important;
            }
            .daily-schedule ul {
              margin: 0 !important;
            }
            .daily-schedule li {
              padding: 1pt 0 !important;
              font-size: 11pt !important;
              line-height: 1.3 !important;
            }
            .daily-schedule .border-b {
              border-bottom-width: 0.5pt !important;
            }
            .daily-schedule .total-section {
              margin-top: 3pt !important;
              padding-top: 3pt !important;
              font-size: 12pt !important;
              font-weight: bold !important;
            }
            .daily-schedule .day-card {
              padding: 5pt !important;
            }
            .space-y-1 > * + * {
              margin-top: 0.25rem !important;
            }
            .py-0\.5 {
              padding-top: 0.5pt !important;
              padding-bottom: 0.5pt !important;
            }
            .ml-2 {
              margin-left: 4pt !important;
            }
            .key-insights {
              font-size: 11pt !important;
              line-height: 1.4 !important;
            }
            .key-insights h2 {
              font-size: 16pt !important;
              font-weight: bold !important;
              margin-bottom: 4pt !important;
            }
            .key-insights ul {
              margin: 0 !important;
            }
            .key-insights li {
              line-height: 1.3 !important;
              font-size: 11pt !important;
            }
            .key-insights .border-t {
              margin-top: 4pt !important;
              padding-top: 4pt !important;
            }
            .grid {
              display: grid !important;
            }
            .grid-cols-1 {
              grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
            }
            .grid-cols-2 {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
            .grid-cols-3 {
              grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            }
            .grid-cols-4 {
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            }
            .text-sm, .text-base {
              font-size: 11pt !important;
            }
            .text-2xl {
              font-size: 20pt !important;
            }
            .text-xl {
              font-size: 16pt !important;
            }
            .text-lg {
              font-size: 13pt !important;
            }
            .font-semibold, .font-bold {
              font-weight: bold !important;
            }
            p, span, div {
              font-size: 11pt !important;
            }

            /* Staff Print Mode - Clean Daily Checklist */
            .print-staff-mode .print-full-report {
              display: none !important;
            }
            .print-staff-mode .staff-checklist {
              display: block !important;
            }
            .print-full-mode .staff-checklist {
              display: none !important;
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
            .staff-checklist .header img {
              display: block !important;
              margin: 0 auto 8pt auto !important;
            }
            .staff-checklist .header .date {
              font-size: 22pt !important;
              color: #1f2937 !important;
              font-weight: bold !important;
            }
            .print-header img {
              display: block !important;
              margin: 0 auto !important;
            }
            .staff-checklist .section-title {
              font-size: 16pt !important;
              font-weight: bold !important;
              color: #1f2937 !important;
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
            .staff-checklist .pie-item:nth-child(even) {
              background: #f9fafb;
            }
            .staff-checklist .pie-name {
              font-size: 11pt !important;
              font-weight: 500 !important;
              color: #374151 !important;
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
              color: #1f2937 !important;
            }
            .staff-checklist .total-value {
              font-size: 16pt !important;
              font-weight: bold !important;
              color: #7c3aed !important;
            }
            .staff-checklist .footer {
              margin-top: 15pt;
              padding-top: 8pt;
              border-top: 1pt solid #d1d5db;
              text-align: center;
              font-size: 9pt;
              color: #6b7280;
            }

            /* Optimize header for weekly checklist */
            .print-staff-mode .staff-checklist .header {
              padding-bottom: 8pt;
              margin-bottom: 10pt;
            }
          }
        `
      }} />

      <div className={`container mx-auto p-6 ${printMode === 'staff' ? 'print-staff-mode' : 'print-full-mode'}`}>
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
                <p className="text-sm text-gray-600">Byron Bay Gourmet Pies Analysis</p>
              </div>
            </div>
            <div className="flex gap-2">
              {analysis && (
                <>
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

        {/* Upload Section */}
        <div className="no-print bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload Square Sales Data</h2>
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
        {error && <p className="text-red-600 mt-2">{error}</p>}
        <p className="text-sm text-gray-600 mb-4">
          Upload Square &quot;Item Sales Detail&quot; CSV export for Byron Bay Gourmet Pies
        </p>

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
            <p className="text-xs text-gray-600 mt-3 bg-blue-50 p-2 rounded">
              💡 <strong>Tip:</strong> Start with 0% buffers to see raw sales data. Add 10-15% general buffer to avoid running out, and 10-15% delivery buffer to stock up on fresh delivery days.
            </p>
          </div>
        )}
      </div>

      {analysis && (
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
                <p className="font-semibold text-purple-800 mb-1">Peak Hours:</p>
                <ul className="space-y-1">
                  {[...analysis.timeAnalysis.hourly]
                    .sort((a, b) => b.sales - a.sales)
                    .slice(0, 3)
                    .map((h, idx) => {
                      const avgPerDay = (h.sales / analysis.totalDays).toFixed(1);
                      return (
                        <li key={h.hour} className="text-gray-700">
                          {idx + 1}. <span className="font-medium">{h.hour}</span> ({h.sales} sold, {avgPerDay}/day)
                        </li>
                      );
                    })}
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

          {/* Today's Recommendations */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg shadow p-6 mb-6 border-2 border-purple-200 avoid-break">
            <h2 className="text-2xl font-bold mb-4 text-purple-900">Today&apos;s Recommendations ({['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]})</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {getTodayRecommendations().map((item) => (
                <div key={item.name} className="bg-white rounded p-3 shadow">
                  <p className="text-sm font-medium text-gray-700">{item.name}</p>
                  <p className="text-2xl font-bold text-purple-600">{item.quantity}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Order Calculator */}
          <div className="bg-white rounded-lg shadow p-6 mb-6 border-2 border-blue-200 avoid-break">
            <h2 className="text-2xl font-bold mb-4 text-blue-900 border-b-2 border-blue-200 pb-2">📦 Order Calculator</h2>
            <p className="text-sm text-gray-600 mb-4">
              Box sizes: Cheese, Spinach & Energy Rolls = 16 pies | All others = 12 pies
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tuesday Delivery */}
              <div className="border-2 border-purple-300 rounded-lg p-4 bg-purple-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-purple-900">🚚 Tuesday Delivery</h3>
                  <span className="text-sm text-purple-700 font-medium">Covers: Tue, Wed</span>
                </div>
                <div className="space-y-2">
                  {calculateOrderForDelivery('tuesday').filter(item => item.boxesNeeded > 0).map((item) => (
                    <div key={item.name} className="bg-white rounded p-3 border border-purple-200">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-gray-900">{item.name}</span>
                        <span className="text-lg font-bold text-purple-600">{item.boxesNeeded} box{item.boxesNeeded !== 1 ? 'es' : ''}</span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Need: {item.totalNeeded} pies</span>
                          <span>Order: {item.totalOrdered} pies ({item.boxesNeeded} × {item.boxSize})</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t-2 border-purple-300">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900">Total Boxes:</span>
                    <span className="text-2xl font-bold text-purple-900">
                      {calculateOrderForDelivery('tuesday').reduce((sum, item) => sum + item.boxesNeeded, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-700 mt-1">
                    <span>Total Pies:</span>
                    <span className="font-semibold">
                      {calculateOrderForDelivery('tuesday').reduce((sum, item) => sum + item.totalOrdered, 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Thursday Delivery */}
              <div className="border-2 border-pink-300 rounded-lg p-4 bg-pink-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-pink-900">🚚 Thursday Delivery</h3>
                  <span className="text-sm text-pink-700 font-medium">Covers: Thu, Fri, Sat, Sun, Mon</span>
                </div>
                <div className="space-y-2">
                  {calculateOrderForDelivery('thursday').filter(item => item.boxesNeeded > 0).map((item) => (
                    <div key={item.name} className="bg-white rounded p-3 border border-pink-200">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-gray-900">{item.name}</span>
                        <span className="text-lg font-bold text-pink-600">{item.boxesNeeded} box{item.boxesNeeded !== 1 ? 'es' : ''}</span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Need: {item.totalNeeded} pies</span>
                          <span>Order: {item.totalOrdered} pies ({item.boxesNeeded} × {item.boxSize})</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t-2 border-pink-300">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900">Total Boxes:</span>
                    <span className="text-2xl font-bold text-pink-900">
                      {calculateOrderForDelivery('thursday').reduce((sum, item) => sum + item.boxesNeeded, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-700 mt-1">
                    <span>Total Pies:</span>
                    <span className="font-semibold">
                      {calculateOrderForDelivery('thursday').reduce((sum, item) => sum + item.totalOrdered, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Cooking Schedule */}
          <div className="bg-white rounded-lg shadow p-6 mb-6 avoid-break daily-schedule">
            <h2 className="text-xl font-semibold mb-4 border-b-2 border-purple-200 pb-2">Daily Cooking Schedule</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, dayIndex) => {
                const dayKey = day.toLowerCase() as keyof PieVariation['recommendedDaily'];
                const isDeliveryDay = day === 'Tuesday' || day === 'Thursday';

                // Get all adjusted values for this day
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
                    <th className="text-left py-2 px-4 font-semibold">Peak Hours</th>
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
                        <td className="py-2 px-4 text-sm text-gray-600">{variation.peakHours.join(', ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              <strong>Delivery Days:</strong> Tuesday (highlighted) and Thursday (highlighted) - recommendations include delivery day buffer if configured.
            </p>
          </div>

          {/* Hourly Sales Chart */}
          <div className="bg-white rounded-lg shadow p-6 mb-6 avoid-break">
            <h2 className="text-xl font-semibold mb-4 border-b-2 border-purple-200 pb-2">Hourly Sales Pattern (Average per Day)</h2>
            <ResponsiveContainer width="100%" height={300} className="chart-container">
              <BarChart data={analysis.timeAnalysis.hourly.map(item => ({
                hour: item.hour,
                avgSales: Number((item.sales / analysis.totalDays).toFixed(1))
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgSales" fill="#8b5cf6" name="Avg Pies/Day" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Period Breakdown */}
          <div className="bg-white rounded-lg shadow p-6 mb-6 avoid-break">
            <h2 className="text-xl font-semibold mb-4 border-b-2 border-purple-200 pb-2">Morning / Lunch / Afternoon Breakdown (Average per Day)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <ResponsiveContainer width="100%" height={300} className="chart-container">
                  <RechartsPie>
                    <Pie
                      data={analysis.timeAnalysis.periods.map(p => ({
                        ...p,
                        avgSales: Number((p.sales / analysis.totalDays).toFixed(1))
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.period}: ${entry.avgSales} (${((entry.sales / analysis.totalPiesSold) * 100).toFixed(1)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="avgSales"
                    >
                      {analysis.timeAnalysis.periods.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4 font-semibold">Period</th>
                      <th className="text-right py-2 px-4 font-semibold">Avg/Day</th>
                      <th className="text-right py-2 px-4 font-semibold">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.timeAnalysis.periods.map((period, idx) => (
                      <tr key={period.period} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="py-2 px-4 font-medium">{period.period}</td>
                        <td className="py-2 px-4 text-right">{(period.sales / analysis.totalDays).toFixed(1)}</td>
                        <td className="py-2 px-4 text-right">{((period.sales / analysis.totalPiesSold) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

          {/* Peak Times Per Variation */}
          <div className="bg-white rounded-lg shadow p-6 avoid-break">
            <h2 className="text-xl font-semibold mb-4 border-b-2 border-purple-200 pb-2">Peak Times by Variation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analysis.variations.map((variation) => (
                <div key={variation.name} className="border rounded p-4">
                  <h3 className="font-semibold mb-2">{variation.name}</h3>
                  <div className="text-sm">
                    <p className="text-gray-600">Peak Hours: <span className="font-medium text-gray-900">{variation.peakHours.join(', ')}</span></p>
                    <p className="text-gray-600">Peak Days: <span className="font-medium text-gray-900">{variation.peakDays.join(', ')}</span></p>
                    <p className="text-gray-600 mt-2">Avg per delivery period: <span className="font-medium text-purple-600">{variation.avgPerDeliveryPeriod.toFixed(1)}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Staff Checklist - Only visible when printing in staff mode */}
      {analysis && (
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

          <div className="footer">
            <p>Generated: {new Date().toLocaleString('en-AU')} | Buffers: General {generalBuffer}%, Delivery +{deliveryBuffer}%</p>
            <p>Delivery Schedule: Tuesday & Thursday | Box sizes: Cheese/Spinach/Energy Rolls = 16 | All others = 12</p>
          </div>
        </div>
      )}

      {/* Print-only footer for full report */}
      {analysis && (
        <div className="print-full-report hidden print:block mt-6 pt-4 border-t text-center text-base text-gray-600">
          <p className="font-semibold">Generated by Wild Octave Organics Pie Calculator | {new Date().toLocaleString()}</p>
          <p className="mt-1">
            Delivery Schedule: Tuesday & Thursday |
            Buffers: General {generalBuffer}%, Delivery Day +{deliveryBuffer}%
          </p>
        </div>
      )}
    </div>
    </>
  );
}
