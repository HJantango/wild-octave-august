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

export function SquareCSVImport({ onImportComplete }: { onImportComplete?: () => void }) {
  const toast = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (files.length === 0) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('file', file);
      });

      const response = await fetch('/api/sales-reports/square-vendor', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        const { created, updated } = data.data.summary;
        toast.success(
          'Success',
          `Created ${created} new items, updated ${updated} items across ${data.data.summary.weeks} weeks`
        );
        if (onImportComplete) {
          onImportComplete();
        }
      } else {
        toast.error('Error', data.error?.message || 'Failed to import CSV');
      }
    } catch (error) {
      toast.error('Error', 'Failed to import CSV file');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Square Vendor Sales CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-3">
            Upload 1-6 weeks of Square "Vendor Sales" CSV exports to automatically create and categorize items.
            Multiple weeks will be averaged for better data. <strong>New items will be created with estimated pricing based on your markup settings.</strong>
          </p>
          <div className="flex items-center space-x-3">
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <Button
              onClick={handleImport}
              disabled={files.length === 0 || isImporting}
            >
              {isImporting ? 'Importing...' : `Import ${files.length} file${files.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
          {files.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              Selected: {files.map(f => f.name).join(', ')}
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-purple-50 p-3 rounded text-center">
                <div className="text-2xl font-bold text-purple-700">{result.summary.weeks}</div>
                <div className="text-xs text-purple-600">Weeks</div>
              </div>
              <div className="bg-gray-50 p-3 rounded text-center">
                <div className="text-2xl font-bold text-gray-900">{result.summary.total}</div>
                <div className="text-xs text-gray-600">Items</div>
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

            {/* Created Items */}
            {result.details.created.length > 0 && (
              <div className="border border-blue-200 rounded p-3 bg-blue-50">
                <h4 className="font-semibold text-blue-900 mb-2">Created Items (Pricing Estimated)</h4>
                <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                  {result.details.created.slice(0, 10).map((item, i) => (
                    <div key={i} className="text-blue-800">
                      <strong>{item.name}</strong>: ${item.sellPrice}
                      {item.subcategory && <span className="text-blue-600"> ({item.subcategory})</span>}
                      {item.avgWeekly && <span className="text-blue-500"> - Avg: {item.avgWeekly}/wk</span>}
                    </div>
                  ))}
                  {result.details.created.length > 10 && (
                    <div className="text-blue-600 text-xs">
                      ... and {result.details.created.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Updated Items */}
            {result.details.updated.length > 0 && (
              <div className="border border-green-200 rounded p-3 bg-green-50">
                <h4 className="font-semibold text-green-900 mb-2">Updated Items</h4>
                <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                  {result.details.updated.map((item, i) => (
                    <div key={i} className="text-green-800">
                      <strong>{item.name}</strong>: {item.previousCategory} → {item.category}
                      {item.subcategory && <span className="text-green-600"> ({item.subcategory})</span>}
                      {item.avgWeekly && <span className="text-green-500"> - Avg: {item.avgWeekly}/wk</span>}
                    </div>
                  ))}
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
