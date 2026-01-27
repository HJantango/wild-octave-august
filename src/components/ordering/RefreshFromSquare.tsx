'use client';

import { useState } from 'react';

interface SyncSummary {
  ordersProcessed: number;
  lineItemsProcessed: number;
  dailyRecordsUpserted: number;
  uniqueItems: number;
  dateRange: { from: string; to: string };
  weeksBack: number;
}

interface RefreshFromSquareProps {
  /** Number of weeks to sync (default 6) */
  weeks?: number;
  /** Callback when sync completes successfully */
  onSyncComplete?: (summary: SyncSummary) => void;
  /** Additional CSS classes */
  className?: string;
}

export default function RefreshFromSquare({
  weeks = 6,
  onSyncComplete,
  className = '',
}: RefreshFromSquareProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setLastSync(null);

    try {
      const response = await fetch('/api/square/sync-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeks }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Sync failed');
      }

      const summary = result.data.summary as SyncSummary;
      setLastSync(summary);
      onSyncComplete?.(summary);
    } catch (err: any) {
      setError(err.message || 'Failed to sync sales data');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`
            inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
            transition-all duration-200
            ${isSyncing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow'
            }
          `}
        >
          {isSyncing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Syncing from Square...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh from Square
            </>
          )}
        </button>

        {lastSync && (
          <span className="text-sm text-green-600 font-medium">
            ✓ Synced {lastSync.dailyRecordsUpserted} records ({lastSync.ordersProcessed} orders)
          </span>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
          ⚠️ {error}
        </div>
      )}

      {lastSync && (
        <div className="text-xs text-gray-500">
          {lastSync.uniqueItems} unique items · {lastSync.dateRange.from} to {lastSync.dateRange.to}
        </div>
      )}
    </div>
  );
}
