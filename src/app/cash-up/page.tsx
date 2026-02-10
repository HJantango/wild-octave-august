'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DollarSignIcon, 
  CoinsIcon, 
  CalculatorIcon,
  CheckCircle2Icon,
  SaveIcon,
  CalendarIcon,
} from 'lucide-react';

// Denomination values
const NOTES = [
  { label: '$100', value: 100 },
  { label: '$50', value: 50 },
  { label: '$20', value: 20 },
  { label: '$10', value: 10 },
  { label: '$5', value: 5 },
];

const COINS = [
  { label: '$2', value: 2 },
  { label: '$1', value: 1 },
  { label: '50c', value: 0.5 },
  { label: '20c', value: 0.2 },
  { label: '10c', value: 0.1 },
  { label: '5c', value: 0.05 },
];

const FLOAT_TARGET = 200;

interface RegisterCounts {
  notes: Record<number, number>;
  coins: Record<number, number>;
}

interface RegisterData {
  counts: RegisterCounts;
  squareCashSales: number;
}

const emptyRegisterCounts = (): RegisterCounts => ({
  notes: { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 },
  coins: { 2: 0, 1: 0, 0.5: 0, 0.2: 0, 0.1: 0, 0.05: 0 },
});

export default function CashUpPage() {
  const [activeRegister, setActiveRegister] = useState<'cafe' | 'door'>('cafe');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [cafeData, setCafeData] = useState<RegisterData>({
    counts: emptyRegisterCounts(),
    squareCashSales: 0,
  });
  
  const [doorData, setDoorData] = useState<RegisterData>({
    counts: emptyRegisterCounts(),
    squareCashSales: 0,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentData = activeRegister === 'cafe' ? cafeData : doorData;
  const setCurrentData = activeRegister === 'cafe' ? setCafeData : setDoorData;

  // Calculate totals
  const calculateTotals = useCallback((counts: RegisterCounts) => {
    const notesTotal = Object.entries(counts.notes).reduce(
      (sum, [denom, count]) => sum + parseFloat(denom) * count,
      0
    );
    const coinsTotal = Object.entries(counts.coins).reduce(
      (sum, [denom, count]) => sum + parseFloat(denom) * count,
      0
    );
    return {
      notesTotal,
      coinsTotal,
      totalCash: notesTotal + coinsTotal,
    };
  }, []);

  const totals = calculateTotals(currentData.counts);
  const cafeTotals = calculateTotals(cafeData.counts);
  const doorTotals = calculateTotals(doorData.counts);

  // Calculate float breakdown
  const calculateFloat = useCallback((counts: RegisterCounts) => {
    const coinsTotal = Object.entries(counts.coins).reduce(
      (sum, [denom, count]) => sum + parseFloat(denom) * count,
      0
    );
    const notesNeeded = Math.max(0, FLOAT_TARGET - coinsTotal);
    
    // Calculate optimal note breakdown for float
    const floatNotes: Record<number, number> = { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 };
    let remaining = notesNeeded;
    
    // Prefer smaller notes for float (easier for making change)
    const noteOrder = [5, 10, 20, 50, 100];
    
    // First pass: use $5 and $10 notes preferentially
    for (const note of [5, 10]) {
      const available = counts.notes[note] || 0;
      const needed = Math.floor(remaining / note);
      const use = Math.min(available, needed);
      floatNotes[note] = use;
      remaining -= use * note;
    }
    
    // Second pass: fill remaining with larger notes if needed
    for (const note of [20, 50, 100]) {
      if (remaining <= 0) break;
      const available = counts.notes[note] || 0;
      const needed = Math.ceil(remaining / note);
      const use = Math.min(available, needed);
      floatNotes[note] = use;
      remaining -= use * note;
    }

    return {
      coinsInFloat: coinsTotal,
      notesNeeded,
      floatNotes,
      actualFloat: coinsTotal + Object.entries(floatNotes).reduce(
        (sum, [denom, count]) => sum + parseFloat(denom) * count, 0
      ),
    };
  }, []);

  const floatBreakdown = calculateFloat(currentData.counts);
  
  // Cash sales = Total Cash - Float
  const cashSales = totals.totalCash - FLOAT_TARGET;

  // Combined totals for both registers
  const combinedCashSales = (cafeTotals.totalCash - FLOAT_TARGET) + (doorTotals.totalCash - FLOAT_TARGET);
  const combinedSquareSales = cafeData.squareCashSales + doorData.squareCashSales;
  const variance = combinedCashSales - combinedSquareSales;

  const updateCount = (type: 'notes' | 'coins', denom: number, value: string) => {
    const count = parseInt(value) || 0;
    setCurrentData(prev => ({
      ...prev,
      counts: {
        ...prev.counts,
        [type]: {
          ...prev.counts[type],
          [denom]: count,
        },
      },
    }));
  };

  const updateSquareSales = (value: string) => {
    const amount = parseFloat(value) || 0;
    setCurrentData(prev => ({
      ...prev,
      squareCashSales: amount,
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  // Save cash-up to database
  const saveCashUp = async () => {
    setSaving(true);
    setSaved(false);
    
    try {
      // Save both registers
      const saveRegister = async (register: 'cafe' | 'door', data: RegisterData) => {
        const response = await fetch('/api/cash-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            register,
            notes100: data.counts.notes[100] || 0,
            notes50: data.counts.notes[50] || 0,
            notes20: data.counts.notes[20] || 0,
            notes10: data.counts.notes[10] || 0,
            notes5: data.counts.notes[5] || 0,
            coins200: data.counts.coins[2] || 0,
            coins100: data.counts.coins[1] || 0,
            coins50: data.counts.coins[0.5] || 0,
            coins20: data.counts.coins[0.2] || 0,
            coins10: data.counts.coins[0.1] || 0,
            coins5: data.counts.coins[0.05] || 0,
            squareCashSales: data.squareCashSales || null,
          }),
        });
        return response.json();
      };

      await Promise.all([
        saveRegister('cafe', cafeData),
        saveRegister('door', doorData),
      ]);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving cash-up:', error);
      alert('Failed to save cash-up. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">💰 Cash Up</h1>
                <p className="text-green-100 text-lg">
                  Daily cash reconciliation for registers
                </p>
              </div>
              <div className="mt-4 lg:mt-0 flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-4 py-2">
                  <CalendarIcon className="w-5 h-5" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent border-none text-white font-medium focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Register Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveRegister('cafe')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeRegister === 'cafe'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ☕ Cafe Register
          </button>
          <button
            onClick={() => setActiveRegister('door')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeRegister === 'door'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🚪 Door Register
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cash Counting Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSignIcon className="w-5 h-5 text-green-600" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4">
                  {NOTES.map((note) => (
                    <div key={note.value} className="text-center">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {note.label}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={currentData.counts.notes[note.value] || ''}
                        onChange={(e) => updateCount('notes', note.value, e.target.value)}
                        className="text-center text-lg font-mono"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formatCurrency((currentData.counts.notes[note.value] || 0) * note.value)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="font-medium text-gray-600">Notes Total:</span>
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(totals.notesTotal)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Coins */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CoinsIcon className="w-5 h-5 text-amber-600" />
                  Coins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-4">
                  {COINS.map((coin) => (
                    <div key={coin.value} className="text-center">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {coin.label}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={currentData.counts.coins[coin.value] || ''}
                        onChange={(e) => updateCount('coins', coin.value, e.target.value)}
                        className="text-center text-lg font-mono"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formatCurrency((currentData.counts.coins[coin.value] || 0) * coin.value)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="font-medium text-gray-600">Coins Total:</span>
                  <span className="text-xl font-bold text-amber-600">
                    {formatCurrency(totals.coinsTotal)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Totals & Float Section */}
          <div className="space-y-6">
            {/* Register Totals */}
            <Card className="border-2 border-emerald-200 bg-emerald-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-emerald-800">
                  <CalculatorIcon className="w-5 h-5" />
                  {activeRegister === 'cafe' ? 'Cafe' : 'Door'} Totals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Total Cash:</span>
                  <span className="text-2xl font-bold text-emerald-700">
                    {formatCurrency(totals.totalCash)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Less Float ($200):</span>
                  <span className="text-lg font-semibold text-gray-500">
                    - {formatCurrency(FLOAT_TARGET)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 bg-white rounded-lg px-3">
                  <span className="font-semibold text-gray-700">Cash Sales:</span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(cashSales)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Float Breakdown */}
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                  💵 Float for Tomorrow
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Coins in float:</span>
                  <span className="font-medium">{formatCurrency(floatBreakdown.coinsInFloat)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Notes needed:</span>
                  <span className="font-medium">{formatCurrency(floatBreakdown.notesNeeded)}</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold text-blue-800 mb-2">Add these notes:</p>
                  <div className="grid grid-cols-5 gap-2 text-center text-sm">
                    {NOTES.map((note) => (
                      <div key={note.value} className={`p-2 rounded ${floatBreakdown.floatNotes[note.value] > 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <div className="font-semibold">{note.label}</div>
                        <div className="text-lg">{floatBreakdown.floatNotes[note.value]}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="font-semibold">Float Total:</span>
                  <span className={`text-xl font-bold ${floatBreakdown.actualFloat >= FLOAT_TARGET ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(floatBreakdown.actualFloat)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Square Sales Entry */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">📊 Square Report</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cash Sales from Square:
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentData.squareCashSales || ''}
                    onChange={(e) => updateSquareSales(e.target.value)}
                    className="pl-8 text-lg font-mono"
                    placeholder="0.00"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Combined Summary */}
        <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-purple-800">
              <CheckCircle2Icon className="w-6 h-6" />
              Daily Summary — Both Registers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Cafe Cash Sales</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(cafeTotals.totalCash - FLOAT_TARGET)}
                </p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Door Cash Sales</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(doorTotals.totalCash - FLOAT_TARGET)}
                </p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Combined Cash Sales</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(combinedCashSales)}
                </p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Square Cash Total</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(combinedSquareSales)}
                </p>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-white rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-700">Variance</p>
                  <p className="text-sm text-gray-500">
                    (Counted Cash Sales - Square Report)
                  </p>
                </div>
                <div className={`text-3xl font-bold ${
                  Math.abs(variance) < 0.01 ? 'text-green-600' : 
                  variance > 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                </div>
              </div>
              {Math.abs(variance) < 0.01 && (
                <div className="mt-3 flex items-center gap-2 text-green-600">
                  <CheckCircle2Icon className="w-5 h-5" />
                  <span className="font-medium">Perfect match! ✨</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end items-center gap-4">
          {saved && (
            <span className="text-green-600 font-medium flex items-center gap-2">
              <CheckCircle2Icon className="w-5 h-5" />
              Saved!
            </span>
          )}
          <Button 
            onClick={saveCashUp}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-lg"
          >
            <SaveIcon className="w-5 h-5 mr-2" />
            {saving ? 'Saving...' : 'Save Cash Up'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
