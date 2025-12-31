'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useItemLabelPrinting } from '@/hooks/useDymoPrinting';
import { Printer, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface LabelPrintingStatusProps {
  compact?: boolean;
}

export function LabelPrintingStatus({ compact = false }: LabelPrintingStatusProps) {
  const { isInitialized, isInitializing, initError, availablePrinters, selectedPrinter, initialize } = useItemLabelPrinting();

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        {isInitializing ? (
          <Badge variant="secondary" className="flex items-center space-x-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Connecting...</span>
          </Badge>
        ) : isInitialized ? (
          <Badge variant="outline" className="flex items-center space-x-1 text-green-600 border-green-200">
            <CheckCircle className="w-3 h-3" />
            <span>Dymo Ready</span>
          </Badge>
        ) : initError ? (
          <Badge variant="destructive" className="flex items-center space-x-1">
            <AlertCircle className="w-3 h-3" />
            <span>Dymo Error</span>
          </Badge>
        ) : (
          <Button variant="outline" size="sm" onClick={initialize} className="flex items-center space-x-1">
            <Printer className="w-3 h-3" />
            <span>Connect Dymo</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Printer className="w-5 h-5" />
          <span>Dymo 550 Turbo Status</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isInitializing ? (
          <div className="flex items-center space-x-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting to Dymo printer...</span>
          </div>
        ) : isInitialized ? (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>Connected and ready to print</span>
            </div>
            <div className="text-sm text-gray-600">
              <p><strong>Printer:</strong> {selectedPrinter || 'Auto-detect'}</p>
              <p><strong>Label Size:</strong> 25mm x 25mm</p>
              <p><strong>Available Printers:</strong> {availablePrinters.length}</p>
            </div>
          </div>
        ) : initError ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>Connection failed</span>
            </div>
            <div className="text-sm text-gray-600">
              <p><strong>Error:</strong> {initError}</p>
            </div>
            <Button onClick={initialize} variant="outline" size="sm">
              Retry Connection
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-gray-600">
              <p>Dymo Connect not initialized</p>
            </div>
            <Button onClick={initialize} className="flex items-center space-x-2">
              <Printer className="w-4 h-4" />
              <span>Connect Dymo Printer</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PrintLabelButtonProps {
  item: {
    name: string;
    sellIncGst?: number;
    sellExGst?: number;
  };
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
  className?: string;
}

export function PrintLabelButton({ 
  item, 
  variant = 'outline', 
  size = 'sm', 
  disabled = false,
  className = ''
}: PrintLabelButtonProps) {
  const { isInitialized, printItem, printSingle } = useItemLabelPrinting();

  const handlePrint = () => {
    if (!isInitialized) {
      alert('Dymo printer not connected. Please connect your Dymo 550 Turbo first.');
      return;
    }
    printItem(item);
  };

  const isPrinting = printSingle.isPending;
  const priceValue = item.sellIncGst || (item.sellExGst || 0) * 1.1;
  const price = typeof priceValue === 'number' ? priceValue : Number(priceValue);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handlePrint}
      disabled={disabled || !isInitialized || isPrinting}
      className={`flex items-center space-x-1 ${className}`}
      title={`Print label: ${item.name} - $${price.toFixed(2)}`}
    >
      {isPrinting ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Printer className="w-3 h-3" />
      )}
      <span>Print</span>
    </Button>
  );
}

interface BulkPrintButtonProps {
  items: Array<{
    name: string;
    sellIncGst?: number;
    sellExGst?: number;
  }>;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function BulkPrintButton({ 
  items, 
  variant = 'default', 
  size = 'default',
  disabled = false,
  className = '',
  children
}: BulkPrintButtonProps) {
  const { isInitialized, printItems, printMultiple } = useItemLabelPrinting();

  const handleBulkPrint = () => {
    if (!isInitialized) {
      alert('Dymo printer not connected. Please connect your Dymo 550 Turbo first.');
      return;
    }
    
    if (items.length === 0) {
      alert('No items selected for printing.');
      return;
    }

    const confirmPrint = confirm(`Print ${items.length} labels to your Dymo 550 Turbo?`);
    if (confirmPrint) {
      printItems(items);
    }
  };

  const isPrinting = printMultiple.isPending;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleBulkPrint}
      disabled={disabled || !isInitialized || isPrinting || items.length === 0}
      className={`flex items-center space-x-2 ${className}`}
    >
      {isPrinting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Printer className="w-4 h-4" />
      )}
      <span>{children || `Print All Labels (${items.length})`}</span>
    </Button>
  );
}

export { useItemLabelPrinting };