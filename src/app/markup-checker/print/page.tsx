'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/format';

interface MarkupItem {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  shelfLabel: string;
  vendorName: string;
  cost: number;
  actualMarkup: number;
  actualSellIncGst: number;
  expectedSellIncGst: number;
  priceDiffIncGst: number;
  status: 'on-target' | 'under' | 'over';
}

interface MarkupData {
  summary: {
    totalItems: number;
    under: number;
    targetMarkup: number;
  };
  items: MarkupItem[];
}

export default function MarkupCheckerPrintPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<MarkupData | null>(null);
  const [loading, setLoading] = useState(true);

  const category = searchParams.get('category') || 'all';
  const shelfLabel = searchParams.get('shelfLabel') || 'all';
  const targetMarkup = searchParams.get('targetMarkup') || '1.75';

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams();
        if (category !== 'all') params.append('category', category);
        if (shelfLabel !== 'all') params.append('shelfLabel', shelfLabel);
        params.append('targetMarkup', targetMarkup);
        
        const res = await fetch(`/api/reports/markup-checker?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json.data);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [category, shelfLabel, targetMarkup]);

  // Auto-print when loaded
  useEffect(() => {
    if (!loading && data) {
      // Small delay to ensure render is complete
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, data]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p>No data available</p>
      </div>
    );
  }

  // Only show under-target items
  const itemsToFix = data.items.filter((i) => i.status === 'under');

  const filterLabel = shelfLabel !== 'all' 
    ? shelfLabel 
    : category !== 'all' 
      ? category 
      : 'All Products';

  return (
    <>
      <style jsx global>{`
        @media print {
          body { 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
        }
        @page {
          size: A4;
          margin: 1cm;
        }
      `}</style>
      
      <div className="p-6 max-w-4xl mx-auto font-sans">
        {/* Header */}
        <div className="mb-6 border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold">🎯 Markup Fixes Required</h1>
          <div className="text-sm text-gray-600 mt-1">
            <span className="font-medium">{filterLabel}</span>
            {' · '}
            Target: {targetMarkup}x
            {' · '}
            {new Date().toLocaleDateString('en-AU', { 
              weekday: 'short', 
              day: 'numeric', 
              month: 'short', 
              year: 'numeric' 
            })}
          </div>
          <div className="text-sm mt-1">
            <span className="font-bold text-red-700">{itemsToFix.length}</span> items need price adjustment
          </div>
        </div>

        {/* Back button - hidden on print */}
        <div className="no-print mb-4">
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            ← Back to Markup Checker
          </button>
          <button 
            onClick={() => window.print()}
            className="ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🖨️ Print
          </button>
        </div>

        {itemsToFix.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            ✅ All products are at or above target markup!
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-400">
                <th className="text-left py-2 pr-2">Product</th>
                <th className="text-left py-2 px-2">Shelf</th>
                <th className="text-right py-2 px-2">Current</th>
                <th className="text-right py-2 px-2">Should Be</th>
                <th className="text-center py-2 pl-2">✓</th>
              </tr>
            </thead>
            <tbody>
              {itemsToFix.map((item, idx) => (
                <tr 
                  key={item.id} 
                  className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-gray-50' : ''}`}
                >
                  <td className="py-2 pr-2">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.vendorName}</div>
                  </td>
                  <td className="py-2 px-2 text-gray-600 text-xs">{item.shelfLabel}</td>
                  <td className="py-2 px-2 text-right font-mono">
                    {formatCurrency(item.actualSellIncGst)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold">
                    {formatCurrency(item.expectedSellIncGst)}
                  </td>
                  <td className="py-2 pl-2 text-center">
                    <span className="inline-block w-5 h-5 border-2 border-gray-400 rounded"></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t text-xs text-gray-500 text-center">
          Wild Octave · Markup Checker · Printed {new Date().toLocaleString('en-AU')}
        </div>
      </div>
    </>
  );
}
