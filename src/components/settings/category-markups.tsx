'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';

const CATEGORY_INFO = {
  'markup_house': { label: 'House', description: 'Store brand products', defaultValue: 1.65 },
  'markup_bulk': { label: 'Bulk', description: 'Bulk items and wholesale', defaultValue: 1.75 },
  'markup_fruit_veg': { label: 'Fruit & Veg', description: 'Fresh produce', defaultValue: 1.75 },
  'markup_fridge_freezer': { label: 'Fridge & Freezer', description: 'Refrigerated and frozen items', defaultValue: 1.5 },
  'markup_naturo': { label: 'Naturo', description: 'Natural health products', defaultValue: 1.65 },
  'markup_groceries': { label: 'Groceries', description: 'Dry goods and pantry items', defaultValue: 1.65 },
  'markup_drinks_fridge': { label: 'Drinks Fridge', description: 'Beverages and drinks', defaultValue: 1.65 },
  'markup_supplements': { label: 'Supplements', description: 'Health supplements and vitamins', defaultValue: 1.65 },
  'markup_personal_care': { label: 'Personal Care', description: 'Toiletries and personal items', defaultValue: 1.65 },
  'markup_fresh_bread': { label: 'Fresh Bread', description: 'Bakery items and fresh bread', defaultValue: 1.5 },
};

export function CategoryMarkups() {
  const { data: settings, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const categoryMarkups = useMemo(() => {
    if (!settings) return {};
    
    const markups: Record<string, { current: number; edited: number }> = {};
    
    Object.entries(CATEGORY_INFO).forEach(([key, info]) => {
      const setting = settings[key];
      const currentValue = setting?.value ?? info.defaultValue;
      const editedValue = editedValues[key] ?? currentValue;
      
      markups[key] = {
        current: currentValue,
        edited: editedValue,
      };
    });
    
    return markups;
  }, [settings, editedValues]);

  const handleMarkupChange = (key: string, value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue <= 0) return;
    
    setEditedValues(prev => ({ ...prev, [key]: numericValue }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const updatesToSend = Object.entries(editedValues).map(([key, value]) => ({
        key,
        value,
        description: CATEGORY_INFO[key as keyof typeof CATEGORY_INFO]?.description,
      }));

      await updateSettings.mutateAsync(updatesToSend);
      setEditedValues({});
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save markups:', error);
    }
  };

  const handleReset = () => {
    setEditedValues({});
    setHasChanges(false);
  };

  const handleResetToDefaults = () => {
    const defaults: Record<string, number> = {};
    Object.entries(CATEGORY_INFO).forEach(([key, info]) => {
      defaults[key] = info.defaultValue;
    });
    setEditedValues(defaults);
    setHasChanges(true);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-red-600 mb-2">Failed to load category markups</div>
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
            <CardTitle>Category Markups</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Set markup multipliers for each product category. These will be applied automatically when processing invoices.
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              onClick={handleResetToDefaults}
              disabled={isLoading || updateSettings.isPending}
            >
              Reset to Defaults
            </Button>
            {hasChanges && (
              <>
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
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            Loading markups...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(CATEGORY_INFO).map(([key, info]) => {
                const markup = categoryMarkups[key];
                const isChanged = editedValues[key] !== undefined;
                
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <label className="text-sm font-medium text-gray-900">
                          {info.label}
                        </label>
                        <p className="text-xs text-gray-500">{info.description}</p>
                      </div>
                      {isChanged && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Modified
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
                        max="10"
                        value={markup?.edited?.toFixed(2) || info.defaultValue.toFixed(2)}
                        onChange={(e) => handleMarkupChange(key, e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-gray-600">×</span>
                      <div className="text-sm text-gray-500">
                        = {((markup?.edited || info.defaultValue - 1) * 100).toFixed(0)}% markup
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-400">
                      Example: $10 cost → ${(10 * (markup?.edited || info.defaultValue)).toFixed(2)} sell price (ex GST)
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Markup Calculation</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>• <strong>Cost Price</strong>: The price you pay to suppliers (ex GST)</div>
                <div>• <strong>Markup</strong>: Multiplier applied to cost price</div>
                <div>• <strong>Sell Price</strong>: Cost × Markup = Your selling price (ex GST)</div>
                <div>• <strong>Final Price</strong>: Sell Price + 10% GST = Customer pays</div>
              </div>
            </div>

            {updateSettings.isError && (
              <div className="bg-red-50 p-3 rounded-md">
                <div className="text-red-800 text-sm">
                  Failed to save settings: {updateSettings.error?.message}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}