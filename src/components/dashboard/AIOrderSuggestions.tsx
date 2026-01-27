'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Suggestion {
  itemName: string;
  action: 'increase' | 'decrease' | 'maintain' | 'stop' | 'review';
  suggestedWeeklyQty: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  alertLevel: 'info' | 'warning' | 'critical';
}

interface AIOrderSuggestionsProps {
  vendors: Array<{ id: string; name: string }>;
}

export function AIOrderSuggestions({ vendors }: AIOrderSuggestionsProps) {
  const [selectedVendor, setSelectedVendor] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(6);

  const handleGenerate = async () => {
    if (!selectedVendor) return;

    setIsLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const response = await fetch('/api/ai/order-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorName: selectedVendor, weeks }),
      });

      const data = await response.json();
      if (data.success || data.data) {
        setSuggestions(data.data?.suggestions || []);
      } else {
        setError(data.error?.message || 'Failed to generate suggestions');
      }
    } catch (err) {
      setError('Failed to generate suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'increase': return '⬆️';
      case 'decrease': return '⬇️';
      case 'maintain': return '➡️';
      case 'stop': return '🛑';
      case 'review': return '🔍';
      default: return '❓';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'increase': return 'bg-green-50 border-green-200';
      case 'decrease': return 'bg-orange-50 border-orange-200';
      case 'maintain': return 'bg-blue-50 border-blue-200';
      case 'stop': return 'bg-red-50 border-red-200';
      case 'review': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-violet-50 to-fuchsia-50">
        <CardTitle className="flex items-center space-x-2">
          <span>🤖</span>
          <span>AI Order Suggestions</span>
        </CardTitle>
        <CardDescription>AI-powered ordering recommendations based on sales trends</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-violet-500 focus:border-violet-500"
          >
            <option value="">Select a vendor...</option>
            {vendors.map(v => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
          <select
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value))}
            className="px-2 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md"
          >
            <option value="4">4w</option>
            <option value="6">6w</option>
            <option value="8">8w</option>
          </select>
          <Button
            onClick={handleGenerate}
            disabled={!selectedVendor || isLoading}
            className="bg-violet-600 hover:bg-violet-700 text-white whitespace-nowrap"
          >
            {isLoading ? '🤔 Thinking...' : '✨ Get Suggestions'}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3 animate-bounce">🧠</div>
            <p className="text-sm text-gray-600">AI is analyzing {selectedVendor} sales data...</p>
            <p className="text-xs text-gray-400 mt-1">This may take 10-15 seconds</p>
          </div>
        )}

        {suggestions.length > 0 && !isLoading && (
          <div className="space-y-2">
            {suggestions.map((suggestion, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${getActionColor(suggestion.action)}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{getActionIcon(suggestion.action)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{suggestion.itemName}</span>
                      <Badge className={`text-[10px] ${getConfidenceBadge(suggestion.confidence)}`}>
                        {suggestion.confidence}
                      </Badge>
                      {suggestion.suggestedWeeklyQty > 0 && (
                        <span className="text-xs text-gray-500">
                          ~{suggestion.suggestedWeeklyQty}/week
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 mt-1">{suggestion.reasoning}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {suggestions.length === 0 && !isLoading && !error && selectedVendor && (
          <div className="text-center py-6 text-gray-500 text-sm">
            Click &quot;Get Suggestions&quot; to analyze {selectedVendor}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
