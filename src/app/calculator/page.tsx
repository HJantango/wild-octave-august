'use client';

import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency } from '@/lib/format';
import { PrintLabelButton } from '@/components/ui/label-printing';

const CATEGORY_INFO = {
  'markup_house': { 
    label: 'House', 
    description: 'Store brand products', 
    defaultValue: 1.65,
    icon: '🏠',
    color: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
  },
  'markup_bulk': { 
    label: 'Bulk', 
    description: 'Bulk items and wholesale', 
    defaultValue: 1.75,
    icon: '📦',
    color: 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
  },
  'markup_fruit_veg': { 
    label: 'Fruit & Veg', 
    description: 'Fresh produce', 
    defaultValue: 1.75,
    icon: '🥕',
    color: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
  },
  'markup_fridge_freezer': { 
    label: 'Fridge & Freezer', 
    description: 'Refrigerated and frozen items', 
    defaultValue: 1.5,
    icon: '❄️',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-300 hover:bg-cyan-200'
  },
  'markup_naturo': { 
    label: 'Naturo', 
    description: 'Natural health products', 
    defaultValue: 1.65,
    icon: '🌿',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
  },
  'markup_groceries': { 
    label: 'Groceries', 
    description: 'Dry goods and pantry items', 
    defaultValue: 1.65,
    icon: '🛒',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
  },
  'markup_drinks_fridge': { 
    label: 'Drinks Fridge', 
    description: 'Beverages and drinks', 
    defaultValue: 1.65,
    icon: '🥤',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200'
  },
  'markup_supplements': { 
    label: 'Supplements', 
    description: 'Health supplements and vitamins', 
    defaultValue: 1.65,
    icon: '💊',
    color: 'bg-pink-100 text-pink-800 border-pink-300 hover:bg-pink-200'
  },
  'markup_personal_care': { 
    label: 'Personal Care', 
    description: 'Toiletries and personal items', 
    defaultValue: 1.65,
    icon: '🧴',
    color: 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
  },
  'markup_fresh_bread': { 
    label: 'Fresh Bread', 
    description: 'Bakery items and fresh bread', 
    defaultValue: 1.5,
    icon: '🍞',
    color: 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200'
  },
};

export default function CalculatorPage() {
  const { data: settings } = useSettings();
  const [costPrice, setCostPrice] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [hasGst, setHasGst] = useState<boolean>(true);
  const [customMarkup, setCustomMarkup] = useState<string>('');
  const [unitSize, setUnitSize] = useState<string>('');
  const [unitType, setUnitType] = useState<string>('kg');
  const [supplyQuantity, setSupplyQuantity] = useState<string>('');

  const calculations = useMemo(() => {
    const cost = parseFloat(costPrice);
    if (isNaN(cost) || cost <= 0) return null;

    let markup = 1.65; // Default

    if (customMarkup) {
      const custom = parseFloat(customMarkup);
      if (!isNaN(custom) && custom > 0) {
        markup = custom;
      }
    } else if (selectedCategory) {
      const categoryMarkup = settings?.[selectedCategory]?.value ?? CATEGORY_INFO[selectedCategory as keyof typeof CATEGORY_INFO]?.defaultValue;
      if (categoryMarkup) {
        markup = categoryMarkup;
      }
    }

    const sellExGst = cost * markup;
    const sellIncGstRaw = hasGst ? sellExGst * 1.1 : sellExGst;
    // Round to nearest 5 cents
    const sellIncGst = Math.round(sellIncGstRaw * 20) / 20;
    const gstAmount = hasGst ? sellIncGst - sellExGst : 0;
    const marginPercent = ((sellExGst - cost) / cost) * 100;

    // Unit calculations
    const unit = parseFloat(unitSize);
    const supply = parseFloat(supplyQuantity);
    const totalUnits = !isNaN(unit) && !isNaN(supply) ? unit * supply : null;
    const costPerUnit = totalUnits ? cost / totalUnits : null;
    const sellPerUnit = totalUnits ? sellExGst / totalUnits : null;
    const sellPerUnitIncGst = totalUnits ? sellIncGst / totalUnits : null;

    return {
      cost,
      markup,
      sellExGst,
      sellIncGst,
      gstAmount,
      marginPercent,
      totalUnits,
      costPerUnit,
      sellPerUnit,
      sellPerUnitIncGst
    };
  }, [costPrice, selectedCategory, hasGst, customMarkup, settings, unitSize, supplyQuantity, unitType]);

  const handleClearAll = () => {
    setCostPrice('');
    setProductName('');
    setSelectedCategory('');
    setHasGst(true);
    setCustomMarkup('');
    setUnitSize('');
    setSupplyQuantity('');
    setUnitType('kg');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Markup Calculator</h1>
          <p className="text-gray-600">Calculate selling prices with automatic category markups</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Product Details</span>
                <Button variant="ghost" size="sm" onClick={handleClearAll}>
                  Clear All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name (Optional)</Label>
                <Input
                  id="productName"
                  placeholder="e.g. Organic Coconut Oil 500ml"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              {/* Cost Price */}
              <div className="space-y-2">
                <Label htmlFor="costPrice" className="text-sm font-medium">
                  Cost Price (ex GST) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Category Selection */}
              <div className="space-y-3">
                <Label>Category</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(CATEGORY_INFO).map(([key, info]) => {
                    const settingValue = settings?.[key]?.value ?? info.defaultValue;
                    const isSelected = selectedCategory === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedCategory(isSelected ? '' : key)}
                        className={`p-3 rounded-lg border-2 text-left transition-all duration-200 ${
                          isSelected 
                            ? info.color + ' border-opacity-100 ring-2 ring-blue-500 ring-opacity-50' 
                            : info.color + ' border-opacity-50 hover:border-opacity-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-lg">{info.icon}</span>
                          <span className="font-medium text-sm">{info.label}</span>
                        </div>
                        <div className="text-xs opacity-75">
                          {settingValue}× ({((settingValue - 1) * 100).toFixed(0)}%)
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedCategory && (
                  <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    {CATEGORY_INFO[selectedCategory as keyof typeof CATEGORY_INFO]?.description}
                  </p>
                )}
              </div>

              {/* Units & Supply */}
              <div className="space-y-2">
                <Label>Units & Supply</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="unitSize" className="text-xs text-gray-500">Unit Size</Label>
                    <Input
                      id="unitSize"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="9"
                      value={unitSize}
                      onChange={(e) => setUnitSize(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="unitType" className="text-xs text-gray-500">Unit</Label>
                    <Select value={unitType} onValueChange={setUnitType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="mL">mL</SelectItem>
                        <SelectItem value="units">units</SelectItem>
                        <SelectItem value="pcs">pcs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="supply" className="text-xs text-gray-500">Supply</Label>
                    <Input
                      id="supply"
                      type="number"
                      step="1"
                      min="1"
                      placeholder="2"
                      value={supplyQuantity}
                      onChange={(e) => setSupplyQuantity(e.target.value)}
                    />
                  </div>
                </div>
                {calculations?.totalUnits && (
                  <div className="bg-blue-50 p-2 rounded text-sm">
                    <strong>Total: {calculations.totalUnits} {unitType}</strong>
                    {calculations.costPerUnit && (
                      <span className="text-gray-600 ml-2">
                        ({formatCurrency(calculations.costPerUnit)}/{unitType} cost)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Custom Markup */}
              <div className="space-y-2">
                <Label htmlFor="customMarkup">Custom Markup (Optional)</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="customMarkup"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="1.65"
                    value={customMarkup}
                    onChange={(e) => setCustomMarkup(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">× (overrides category markup)</span>
                </div>
              </div>

              {/* GST Toggle */}
              <div className="space-y-2">
                <Label>GST Status</Label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gst"
                      checked={hasGst}
                      onChange={() => setHasGst(true)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">GST Applicable (10%)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gst"
                      checked={!hasGst}
                      onChange={() => setHasGst(false)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">GST Free</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pricing Results</span>
                {calculations && productName && (
                  <PrintLabelButton 
                    item={{
                      name: productName,
                      sellIncGst: calculations.sellIncGst
                    }}
                    variant="outline"
                    size="sm"
                  >
                    🏷️ Print Label
                  </PrintLabelButton>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!calculations ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🧮</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Enter Cost Price</h3>
                  <p className="text-gray-500">Add a cost price to see markup calculations</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Main Results */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">
                        Cost Price (ex GST)
                      </div>
                      <div className="text-2xl font-bold text-blue-900">
                        {formatCurrency(calculations.cost)}
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-1">
                        Markup Applied
                      </div>
                      <div className="text-2xl font-bold text-purple-900">
                        {calculations.markup.toFixed(2)}×
                      </div>
                      <div className="text-xs text-purple-700">
                        {((calculations.markup - 1) * 100).toFixed(0)}% markup
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">
                        Sell Price (ex GST)
                      </div>
                      <div className="text-2xl font-bold text-green-900">
                        {formatCurrency(calculations.sellExGst)}
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200">
                      <div className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">
                        Final Price {hasGst ? '(inc GST)' : '(GST Free)'}
                      </div>
                      <div className="text-3xl font-bold text-emerald-900">
                        {formatCurrency(calculations.sellIncGst)}
                      </div>
                      {hasGst && (
                        <div className="text-xs text-emerald-700">
                          includes {formatCurrency(calculations.gstAmount)} GST
                        </div>
                      )}
                      {calculations.totalUnits && calculations.sellPerUnitIncGst && (
                        <div className="text-sm text-emerald-800 mt-1 border-t border-emerald-200 pt-1">
                          {formatCurrency(calculations.sellPerUnitIncGst)}/{unitType}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Calculation Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cost Price:</span>
                        <span className="font-medium">{formatCurrency(calculations.cost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">× Markup ({calculations.markup.toFixed(2)}):</span>
                        <span className="font-medium">{formatCurrency(calculations.sellExGst)}</span>
                      </div>
                      {hasGst && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">+ GST (10%):</span>
                          <span className="font-medium">{formatCurrency(calculations.gstAmount)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Customer Pays:</span>
                        <span className="text-green-600">{formatCurrency(calculations.sellIncGst)}</span>
                      </div>
                      {calculations.totalUnits && (
                        <>
                          <div className="border-t pt-2 text-xs text-gray-500">
                            <div className="font-medium mb-1">Per Unit Breakdown:</div>
                            <div className="flex justify-between">
                              <span>Cost per {unitType}:</span>
                              <span>{formatCurrency(calculations.costPerUnit!)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Sell per {unitType} (ex GST):</span>
                              <span>{formatCurrency(calculations.sellPerUnit!)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Sell per {unitType} (inc GST):</span>
                              <span className="text-green-600">{formatCurrency(calculations.sellPerUnitIncGst!)}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Profit Margin */}
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-yellow-900">Gross Margin</div>
                        <div className="text-xs text-yellow-700">Before operating costs</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-yellow-900">
                          {calculations.marginPercent.toFixed(1)}%
                        </div>
                        <div className="text-xs text-yellow-700">
                          {formatCurrency(calculations.sellExGst - calculations.cost)} profit
                        </div>
                      </div>
                    </div>
                  </div>

                  {productName && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-blue-900 mb-2">Label Preview</div>
                      <div className="bg-white border-2 border-dashed border-blue-200 p-3 rounded text-center">
                        <div className="font-medium text-gray-900 text-sm">{productName}</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(calculations.sellIncGst)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Category Markup Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(CATEGORY_INFO).map(([key, info]) => {
                const settingValue = settings?.[key]?.value ?? info.defaultValue;
                return (
                  <div key={key} className={`text-center p-3 rounded-lg border ${info.color}`}>
                    <div className="text-2xl mb-1">{info.icon}</div>
                    <div className="text-sm font-medium">{info.label}</div>
                    <div className="text-lg font-bold">{settingValue}×</div>
                    <div className="text-xs opacity-75">
                      {((settingValue - 1) * 100).toFixed(0)}% markup
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}