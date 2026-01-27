'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Alert {
  type: 'declining_sales' | 'increasing_sales' | 'high_wastage' | 'dead_stock';
  severity: 'info' | 'warning' | 'critical';
  itemName: string;
  message: string;
  metric: string;
  actionSuggestion: string;
}

interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

export function SmartAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const response = await fetch('/api/ai/smart-alerts');
      const data = await response.json();
      if (data.success || data.data) {
        setAlerts(data.data?.alerts || []);
        setSummary(data.data?.summary || null);
      }
    } catch (error) {
      console.error('Failed to load smart alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'declining_sales': return '📉';
      case 'increasing_sales': return '📈';
      case 'high_wastage': return '🗑️';
      case 'dead_stock': return '💀';
      default: return '⚠️';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'warning': return 'bg-yellow-500 text-white';
      case 'info': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const filteredAlerts = alerts.filter(alert =>
    filterType === 'all' || alert.type === filterType
  );

  const displayAlerts = showAll ? filteredAlerts : filteredAlerts.slice(0, 6);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
          <CardTitle className="flex items-center space-x-2">
            <span>🧠</span>
            <span>Smart Alerts</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-500 text-sm">Analyzing your data...</p>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
          <CardTitle className="flex items-center space-x-2">
            <span>✅</span>
            <span>Smart Alerts</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-green-600 text-sm font-medium">All clear! No alerts at this time.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>🧠</span>
              <span>Smart Alerts</span>
              {summary && summary.critical > 0 && (
                <Badge className="bg-red-500 text-white ml-2">{summary.critical} critical</Badge>
              )}
            </CardTitle>
            <CardDescription>AI-powered insights from your sales & wastage data</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded-md"
            >
              <option value="all">All ({alerts.length})</option>
              <option value="declining_sales">📉 Declining</option>
              <option value="increasing_sales">📈 Increasing</option>
              <option value="high_wastage">🗑️ Wastage</option>
              <option value="dead_stock">💀 Dead Stock</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {displayAlerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
            >
              <span className="text-lg flex-shrink-0 mt-0.5">{getAlertIcon(alert.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{alert.itemName}</span>
                  <Badge className={`text-[10px] px-1.5 py-0 ${getSeverityBadge(alert.severity)}`}>
                    {alert.severity}
                  </Badge>
                </div>
                <p className="text-xs mt-0.5">{alert.message}</p>
                <p className="text-xs opacity-75">{alert.metric}</p>
                <p className="text-xs font-medium mt-1">💡 {alert.actionSuggestion}</p>
              </div>
            </div>
          ))}
        </div>

        {filteredAlerts.length > 6 && (
          <div className="mt-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-xs"
            >
              {showAll ? 'Show Less' : `Show All ${filteredAlerts.length} Alerts`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
