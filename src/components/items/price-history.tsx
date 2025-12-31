'use client';

import { formatCurrency, formatDateTime } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PriceHistoryEntry {
  id: string;
  costExGst: number;
  markup: number;
  sellExGst: number;
  sellIncGst: number;
  changedAt: string;
  sourceInvoice?: {
    id: string;
    invoiceDate: string;
  };
}

interface PriceHistoryProps {
  priceHistory: PriceHistoryEntry[];
  currentPrice: {
    costExGst: number;
    markup: number;
    sellExGst: number;
    sellIncGst: number;
  };
}

export function PriceHistory({ priceHistory, currentPrice }: PriceHistoryProps) {
  if (priceHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">📊</div>
            <p>No price history available</p>
            <p className="text-sm mt-2">Price changes will appear here when invoices are processed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allEntries = [
    {
      id: 'current',
      costExGst: currentPrice.costExGst,
      markup: currentPrice.markup,
      sellExGst: currentPrice.sellExGst,
      sellIncGst: currentPrice.sellIncGst,
      changedAt: new Date().toISOString(),
      isCurrent: true,
    },
    ...priceHistory.map(entry => ({ ...entry, isCurrent: false }))
  ];

  const getPriceChangeIndicator = (current: number, previous: number) => {
    if (current === previous) return null;
    
    const change = ((current - previous) / previous) * 100;
    const isIncrease = current > previous;
    
    return (
      <Badge variant={isIncrease ? 'warning' : 'success'} className="ml-2">
        {isIncrease ? '↗️' : '↘️'} {change > 0 ? '+' : ''}{change.toFixed(1)}%
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allEntries.map((entry, index) => {
            const previousEntry = allEntries[index + 1];
            
            return (
              <div 
                key={entry.id}
                className={`p-4 rounded-lg border ${
                  entry.isCurrent 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${
                      entry.isCurrent ? 'text-primary' : 'text-gray-700'
                    }`}>
                      {entry.isCurrent ? 'Current Price' : formatDateTime(entry.changedAt)}
                    </span>
                    {entry.isCurrent && (
                      <Badge variant="default">Current</Badge>
                    )}
                  </div>
                  {entry.sourceInvoice && (
                    <Badge variant="secondary">
                      Invoice: {entry.sourceInvoice.id.slice(0, 8)}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 mb-1">Cost (ex GST)</div>
                    <div className="font-medium flex items-center">
                      {formatCurrency(entry.costExGst)}
                      {previousEntry && getPriceChangeIndicator(entry.costExGst, previousEntry.costExGst)}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-gray-500 mb-1">Markup</div>
                    <div className="font-medium flex items-center">
                      {((entry.markup - 1) * 100).toFixed(0)}%
                      {previousEntry && getPriceChangeIndicator(entry.markup, previousEntry.markup)}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-gray-500 mb-1">Sell (ex GST)</div>
                    <div className="font-medium flex items-center">
                      {formatCurrency(entry.sellExGst)}
                      {previousEntry && getPriceChangeIndicator(entry.sellExGst, previousEntry.sellExGst)}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-gray-500 mb-1">Sell (inc GST)</div>
                    <div className="font-medium flex items-center">
                      {formatCurrency(entry.sellIncGst)}
                      {previousEntry && getPriceChangeIndicator(entry.sellIncGst, previousEntry.sellIncGst)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}