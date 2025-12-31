'use client';

import Link from 'next/link';
import { Item } from '@/hooks/useItems';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/format';
import { PrintLabelButton } from '@/components/ui/label-printing';

interface ItemsTableProps {
  items: Item[];
  loading?: boolean;
}

function PriceChangeIndicator({ item }: { item: Item }) {
  if (!item.hasPriceChanged || !item.lastPriceChange) {
    return null;
  }

  const currentCost = item.currentCostExGst;
  const previousCost = item.lastPriceChange.previousCost;
  const isIncrease = currentCost > previousCost;
  const change = ((currentCost - previousCost) / previousCost) * 100;

  return (
    <div className="flex items-center space-x-2">
      <Badge variant={isIncrease ? 'warning' : 'success'}>
        {isIncrease ? '📈' : '📉'} {change > 0 ? '+' : ''}{change.toFixed(1)}%
      </Badge>
      <span className="text-xs text-gray-500">
        was {formatCurrency(previousCost)}
      </span>
    </div>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'House': 'bg-blue-100 text-blue-800',
    'Bulk': 'bg-purple-100 text-purple-800',
    'Fruit & Veg': 'bg-green-100 text-green-800',
    'Fridge & Freezer': 'bg-cyan-100 text-cyan-800',
    'Naturo': 'bg-emerald-100 text-emerald-800',
    'Groceries': 'bg-yellow-100 text-yellow-800',
    'Drinks Fridge': 'bg-indigo-100 text-indigo-800',
    'Supplements': 'bg-pink-100 text-pink-800',
    'Personal Care': 'bg-rose-100 text-rose-800',
    'Fresh Bread': 'bg-orange-100 text-orange-800',
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
}

export function ItemsTable({ items, loading }: ItemsTableProps) {
  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-lg border">
        <div className="px-4 py-8 text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          Loading items...
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-lg border">
        <div className="px-4 py-8 text-center text-gray-500">
          <div className="text-4xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pricing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price Changes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Updated
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {item.name}
                    </div>
                    <div className="text-sm text-gray-500 space-x-2">
                      {item.sku && <span>Vendor Code: {item.sku}</span>}
                      {item.barcode && <span>Barcode: {item.barcode}</span>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(item.category)}`}>
                    {item.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {item.vendor?.name || 'Unknown'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    <div>Cost: {formatCurrency(item.currentCostExGst)}</div>
                    <div>Sell: {formatCurrency(item.currentSellIncGst)} <span className="text-gray-500">(inc GST)</span></div>
                    <div className="text-xs text-gray-500">
                      Markup: {((item.currentMarkup - 1) * 100).toFixed(0)}%
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <PriceChangeIndicator item={item} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(item.updatedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <PrintLabelButton 
                      item={{
                        name: item.name,
                        sellIncGst: item.currentSellIncGst
                      }}
                      variant="outline"
                      size="sm"
                    />
                    <Link href={`/items/${item.id}`}>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}