'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';

const OCR_PROVIDERS = [
  { value: 'tesseract', label: 'Tesseract (Free, Local)' },
  { value: 'azure', label: 'Azure Cognitive Services (Paid, Cloud)' },
];

export function GeneralSettings() {
  const { data: settings, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const currentSettings = useMemo(() => {
    if (!settings) return {};
    
    return {
      gst_rate: editedValues.gst_rate ?? settings.gst_rate?.value ?? 0.10,
      ocr_provider: editedValues.ocr_provider ?? settings.ocr_provider?.value ?? 'tesseract',
      accounts_email: editedValues.accounts_email ?? settings.accounts_email?.value ?? 'accounts@wildoctave.com',
    };
  }, [settings, editedValues]);

  const handleSettingChange = (key: string, value: any) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const updatesToSend = Object.entries(editedValues).map(([key, value]) => {
        let description = '';
        switch (key) {
          case 'gst_rate':
            description = 'GST rate for pricing calculations';
            break;
          case 'ocr_provider':
            description = 'Fallback OCR provider for invoice processing (AI processing is primary)';
            break;
          case 'accounts_email':
            description = 'Email address for sending processed invoices';
            break;
        }
        
        return { key, value, description };
      });

      await updateSettings.mutateAsync(updatesToSend);
      setEditedValues({});
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleReset = () => {
    setEditedValues({});
    setHasChanges(false);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-red-600 mb-2">Failed to load general settings</div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>General Settings</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Configure global application settings
            </p>
          </div>
          {hasChanges && (
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                onClick={handleReset}
                disabled={updateSettings.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            Loading settings...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* GST Rate */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  GST Rate
                </label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={currentSettings.gst_rate}
                    onChange={(e) => handleSettingChange('gst_rate', parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">
                    = {(currentSettings.gst_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  The GST rate applied to all pricing calculations (e.g., 0.10 for 10% GST)
                </p>
                <div className="text-xs text-gray-400">
                  Example: $100 + {(currentSettings.gst_rate * 100).toFixed(1)}% = ${(100 * (1 + currentSettings.gst_rate)).toFixed(2)}
                </div>
              </div>

              {/* OCR Provider */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Fallback OCR Provider
                </label>
                <Select value={currentSettings.ocr_provider} onValueChange={(value) => handleSettingChange('ocr_provider', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select OCR provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {OCR_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Choose the fallback OCR engine (AI vision processing is used first)
                </p>
                {currentSettings.ocr_provider === 'azure' && (
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    ⚠️ Azure OCR requires AZURE_OCR_ENDPOINT and AZURE_OCR_KEY environment variables
                  </div>
                )}
              </div>

              {/* Accounts Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Accounts Email
                </label>
                <Input
                  type="email"
                  value={currentSettings.accounts_email || ''}
                  onChange={(e) => handleSettingChange('accounts_email', e.target.value)}
                  placeholder="accounts@example.com"
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Email address for sending processed invoices
                </p>
              </div>
            </div>

            {/* Processing Pipeline */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Invoice Processing Pipeline</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium text-blue-700 mb-1">🤖 Claude Vision AI (Primary)</div>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Advanced AI understanding</li>
                    <li>• Brand extraction</li>
                    <li>• Complex layout handling</li>
                    <li>• 40+ invoice formats</li>
                  </ul>
                </div>
                <div>
                  <div className="font-medium text-green-700 mb-1">✅ Tesseract (Fallback)</div>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Free and open source</li>
                    <li>• Runs locally (privacy)</li>
                    <li>• No API limits or costs</li>
                    <li>• Good for standard invoices</li>
                  </ul>
                </div>
                <div>
                  <div className="font-medium text-gray-700 mb-1">🔮 Azure Cognitive Services</div>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Higher accuracy</li>
                    <li>• Better handwriting support</li>
                    <li>• Handles complex layouts</li>
                    <li>• Requires Azure account (paid)</li>
                  </ul>
                </div>
              </div>
            </div>

            {updateSettings.isError && (
              <div className="bg-red-50 p-3 rounded-md">
                <div className="text-red-800 text-sm">
                  Failed to save settings: {updateSettings.error?.message}
                </div>
              </div>
            )}

            {updateSettings.isSuccess && (
              <div className="bg-green-50 p-3 rounded-md">
                <div className="text-green-800 text-sm">
                  Settings saved successfully!
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}