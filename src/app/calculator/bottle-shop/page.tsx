'use client';

import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/format';

interface PackComparison {
  name: string;
  packSize: number;
  price: number;
  pricePerUnit: number;
}

export default function BottleShopCalculatorPage() {
  // 6-pack vs 4-pack comparison
  const [sixPackPrice, setSixPackPrice] = useState<string>('');
  const [fourPackPrice, setFourPackPrice] = useState<string>('');
  const [singlePrice, setSinglePrice] = useState<string>('');

  // Custom comparison
  const [customPacks, setCustomPacks] = useState<{ size: string; price: string }[]>([
    { size: '6', price: '' },
    { size: '4', price: '' },
  ]);

  const standardComparison = useMemo(() => {
    const comparisons: PackComparison[] = [];

    const sixPrice = parseFloat(sixPackPrice);
    if (!isNaN(sixPrice) && sixPrice > 0) {
      comparisons.push({
        name: '6-Pack',
        packSize: 6,
        price: sixPrice,
        pricePerUnit: sixPrice / 6,
      });
    }

    const fourPrice = parseFloat(fourPackPrice);
    if (!isNaN(fourPrice) && fourPrice > 0) {
      comparisons.push({
        name: '4-Pack',
        packSize: 4,
        price: fourPrice,
        pricePerUnit: fourPrice / 4,
      });
    }

    const single = parseFloat(singlePrice);
    if (!isNaN(single) && single > 0) {
      comparisons.push({
        name: 'Single',
        packSize: 1,
        price: single,
        pricePerUnit: single,
      });
    }

    // Sort by price per unit (best value first)
    comparisons.sort((a, b) => a.pricePerUnit - b.pricePerUnit);

    return comparisons;
  }, [sixPackPrice, fourPackPrice, singlePrice]);

  const customComparison = useMemo(() => {
    const comparisons: PackComparison[] = [];

    for (const pack of customPacks) {
      const size = parseInt(pack.size);
      const price = parseFloat(pack.price);
      if (!isNaN(size) && size > 0 && !isNaN(price) && price > 0) {
        comparisons.push({
          name: size === 1 ? 'Single' : `${size}-Pack`,
          packSize: size,
          price: price,
          pricePerUnit: price / size,
        });
      }
    }

    comparisons.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
    return comparisons;
  }, [customPacks]);

  const addCustomPack = () => {
    setCustomPacks([...customPacks, { size: '', price: '' }]);
  };

  const removeCustomPack = (index: number) => {
    setCustomPacks(customPacks.filter((_, i) => i !== index));
  };

  const updateCustomPack = (index: number, field: 'size' | 'price', value: string) => {
    const updated = [...customPacks];
    updated[index][field] = value;
    setCustomPacks(updated);
  };

  const clearStandard = () => {
    setSixPackPrice('');
    setFourPackPrice('');
    setSinglePrice('');
  };

  const clearCustom = () => {
    setCustomPacks([
      { size: '6', price: '' },
      { size: '4', price: '' },
    ]);
  };

  const renderComparisonResults = (comparisons: PackComparison[]) => {
    if (comparisons.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🍺</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Enter Prices to Compare</h3>
          <p className="text-gray-500">Add pack prices to see which is better value</p>
        </div>
      );
    }

    const bestValue = comparisons[0];
    const worstValue = comparisons[comparisons.length - 1];

    return (
      <div className="space-y-4">
        {/* Winner Banner */}
        {comparisons.length > 1 && (
          <div className="bg-green-100 border-2 border-green-400 rounded-lg p-4 text-center">
            <div className="text-2xl mb-1">🏆</div>
            <div className="text-lg font-bold text-green-800">
              {bestValue.name} is Best Value!
            </div>
            <div className="text-green-700">
              {formatCurrency(bestValue.pricePerUnit)} per bottle
            </div>
            {comparisons.length > 1 && (
              <div className="text-sm text-green-600 mt-1">
                Save {formatCurrency(worstValue.pricePerUnit - bestValue.pricePerUnit)} per bottle vs {worstValue.name}
              </div>
            )}
          </div>
        )}

        {/* Comparison Cards */}
        <div className="grid gap-3">
          {comparisons.map((pack, index) => {
            const isBest = index === 0 && comparisons.length > 1;
            const isWorst = index === comparisons.length - 1 && comparisons.length > 1;
            const savingsVsWorst = worstValue ? (worstValue.pricePerUnit - pack.pricePerUnit) * pack.packSize : 0;

            return (
              <div
                key={pack.name}
                className={`p-4 rounded-lg border-2 ${
                  isBest
                    ? 'bg-green-50 border-green-400'
                    : isWorst
                    ? 'bg-red-50 border-red-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {isBest ? '✅' : isWorst ? '❌' : '➖'}
                      </span>
                      <span className="font-bold text-lg">{pack.name}</span>
                      {isBest && (
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                          BEST VALUE
                        </span>
                      )}
                    </div>
                    <div className="text-gray-600 mt-1">
                      Pack price: {formatCurrency(pack.price)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${isBest ? 'text-green-600' : isWorst ? 'text-red-600' : 'text-gray-800'}`}>
                      {formatCurrency(pack.pricePerUnit)}
                    </div>
                    <div className="text-sm text-gray-500">per bottle</div>
                  </div>
                </div>
                {savingsVsWorst > 0.01 && !isWorst && (
                  <div className="mt-2 text-sm text-green-700 bg-green-100 rounded px-2 py-1 inline-block">
                    Save {formatCurrency(savingsVsWorst)} on this pack vs {worstValue.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Stats */}
        {comparisons.length > 1 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">💡 Quick Stats</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • Price range: {formatCurrency(bestValue.pricePerUnit)} - {formatCurrency(worstValue.pricePerUnit)} per bottle
              </li>
              <li>
                • Difference: {formatCurrency(worstValue.pricePerUnit - bestValue.pricePerUnit)} per bottle ({((1 - bestValue.pricePerUnit / worstValue.pricePerUnit) * 100).toFixed(0)}% cheaper)
              </li>
              {bestValue.packSize > 1 && (
                <li>
                  • Buying {bestValue.packSize} individually at worst price: {formatCurrency(worstValue.pricePerUnit * bestValue.packSize)} vs {formatCurrency(bestValue.price)} for {bestValue.name}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🍺 Bottle Shop Calculator</h1>
          <p className="text-gray-600">Compare pack sizes to find the best value</p>
        </div>

        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="standard">6-Pack vs 4-Pack</TabsTrigger>
            <TabsTrigger value="custom">Custom Comparison</TabsTrigger>
          </TabsList>

          {/* Standard 6 vs 4 Pack Tab */}
          <TabsContent value="standard">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Enter Prices</span>
                    <Button variant="ghost" size="sm" onClick={clearStandard}>
                      Clear
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sixPack" className="flex items-center gap-2">
                      <span className="text-xl">📦</span> 6-Pack Price
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="sixPack"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={sixPackPrice}
                        onChange={(e) => setSixPackPrice(e.target.value)}
                        className="pl-8 text-lg"
                      />
                    </div>
                    {sixPackPrice && !isNaN(parseFloat(sixPackPrice)) && (
                      <div className="text-sm text-gray-500">
                        = {formatCurrency(parseFloat(sixPackPrice) / 6)} per bottle
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fourPack" className="flex items-center gap-2">
                      <span className="text-xl">📦</span> 4-Pack Price
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="fourPack"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={fourPackPrice}
                        onChange={(e) => setFourPackPrice(e.target.value)}
                        className="pl-8 text-lg"
                      />
                    </div>
                    {fourPackPrice && !isNaN(parseFloat(fourPackPrice)) && (
                      <div className="text-sm text-gray-500">
                        = {formatCurrency(parseFloat(fourPackPrice) / 4)} per bottle
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="single" className="flex items-center gap-2">
                      <span className="text-xl">🍺</span> Single Price (optional)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="single"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={singlePrice}
                        onChange={(e) => setSinglePrice(e.target.value)}
                        className="pl-8 text-lg"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Comparison Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderComparisonResults(standardComparison)}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Custom Comparison Tab */}
          <TabsContent value="custom">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Custom Pack Sizes</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={clearCustom}>
                        Clear
                      </Button>
                      <Button variant="outline" size="sm" onClick={addCustomPack}>
                        + Add Pack
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customPacks.map((pack, index) => (
                    <div key={index} className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500">Pack Size</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="6"
                          value={pack.size}
                          onChange={(e) => updateCustomPack(index, 'size', e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500">Price ($)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={pack.price}
                            onChange={(e) => updateCustomPack(index, 'price', e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>
                      {customPacks.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomPack(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-gray-500">
                    Compare any pack sizes — bottles, cans, cases, whatever!
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Comparison Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderComparisonResults(customComparison)}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Navigation back to main calculator */}
        <div className="text-center">
          <a href="/calculator" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to Markup Calculator
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
