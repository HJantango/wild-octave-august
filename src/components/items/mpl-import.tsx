'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

interface ImportResult {
  summary: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  details: {
    created: any[];
    updated: any[];
    skipped: any[];
    errors: any[];
  };
}

export function MPLImport({ onImportComplete }: { onImportComplete?: () => void }) {
  const toast = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/items/import-mpl', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        toast.success(
          'Success',
          `Updated ${data.data.summary.updated} items with cost and inventory data`
        );
        if (onImportComplete) {
          onImportComplete();
        }
      } else {
        toast.error('Error', data.error?.message || 'Failed to import MPL');
      }
    } catch (error) {
      toast.error('Error', 'Failed to import MPL file');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Master Product List (MPL)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-3">
            Upload Square's Master Product List catalog export to update:
            <strong> Cost prices, Current inventory levels, Shelf locations</strong>.
            Items are matched by name.
          </p>
          <div className="flex items-center space-x-3">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-purple-50 file:text-purple-700
                hover:file:bg-purple-100"
            />
            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isImporting ? 'Importing...' : 'Import MPL'}
            </Button>
          </div>
        </div>

        {result && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-gray-50 p-3 rounded text-center">
                <div className="text-2xl font-bold text-gray-900">{result.summary.total}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
              <div className="bg-green-50 p-3 rounded text-center">
                <div className="text-2xl font-bold text-green-700">{result.summary.updated}</div>
                <div className="text-xs text-green-600">Updated</div>
              </div>
              <div className="bg-blue-50 p-3 rounded text-center">
                <div className="text-2xl font-bold text-blue-700">{result.summary.created}</div>
                <div className="text-xs text-blue-600">Created</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded text-center">
                <div className="text-2xl font-bold text-yellow-700">{result.summary.skipped}</div>
                <div className="text-xs text-yellow-600">Skipped</div>
              </div>
              <div className="bg-red-50 p-3 rounded text-center">
                <div className="text-2xl font-bold text-red-700">{result.summary.errors}</div>
                <div className="text-xs text-red-600">Errors</div>
              </div>
            </div>

            {/* Updated Items */}
            {result.details.updated.length > 0 && (
              <div className="border border-green-200 rounded p-3 bg-green-50">
                <h4 className="font-semibold text-green-900 mb-2">
                  Updated Items (Cost + Stock + Shelf)
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                  {result.details.updated.slice(0, 10).map((item, i) => (
                    <div key={i} className="text-green-800">
                      <strong>{item.name}</strong>: Cost ${item.cost}, Stock {item.stock}
                      {item.shelf && <span className="text-green-600"> → {item.shelf}</span>}
                    </div>
                  ))}
                  {result.details.updated.length > 10 && (
                    <div className="text-green-600 text-xs">
                      ... and {result.details.updated.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Skipped Items */}
            {result.details.skipped.length > 0 && (
              <div className="border border-yellow-200 rounded p-3 bg-yellow-50">
                <h4 className="font-semibold text-yellow-900 mb-2">Skipped Items</h4>
                <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                  {result.details.skipped.slice(0, 10).map((item, i) => (
                    <div key={i} className="text-yellow-800">
                      <strong>{item.itemName}</strong>: {item.reason}
                    </div>
                  ))}
                  {result.details.skipped.length > 10 && (
                    <div className="text-yellow-600 text-xs">
                      ... and {result.details.skipped.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Errors */}
            {result.details.errors.length > 0 && (
              <div className="border border-red-200 rounded p-3 bg-red-50">
                <h4 className="font-semibold text-red-900 mb-2">Errors</h4>
                <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                  {result.details.errors.map((item, i) => (
                    <div key={i} className="text-red-800">
                      <strong>{item.itemName}</strong>: {item.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
