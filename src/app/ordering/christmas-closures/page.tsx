'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChristmasClosureItem {
  id: string;
  vendor: string;
  lastOrderDate: string; // Format: DD MMM (e.g., "19 Dec")
  closingDate: string;   // Format: DD MMM
  openingDate: string;   // Format: DD MMM
  specialDelivery1?: string; // Optional special delivery date during closure
  specialDelivery2?: string; // Optional second special delivery
  specialDelivery3?: string; // Optional third special delivery
  finalOrderCompleted?: boolean; // Track if final Christmas order has been placed
}

const INITIAL_CHRISTMAS_CLOSURES: ChristmasClosureItem[] = [
  {
    id: 'xmas-1',
    vendor: 'Naturis',
    lastOrderDate: '19 Dec',
    closingDate: '22 Dec',
    openingDate: '4 Jan'
  },
  {
    id: 'xmas-2',
    vendor: 'Byron Gourmet Pies',
    lastOrderDate: '20 Dec',
    closingDate: '22 Dec',
    openingDate: '6 Jan',
    specialDelivery1: '30 Dec'
  }
];

export default function ChristmasClosuresPage() {
  const [closures, setClosures] = useState<ChristmasClosureItem[]>(INITIAL_CHRISTMAS_CLOSURES);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('christmas_closures');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setClosures(parsed);
      } catch (e) {
        console.error('Failed to load saved closures:', e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('christmas_closures', JSON.stringify(closures));
    setIsEditing(false);
    alert('Christmas closures saved!');
  };

  const handlePrint = () => {
    window.print();
  };

  const updateClosureItem = (index: number, field: keyof ChristmasClosureItem, value: string) => {
    const newClosures = [...closures];
    newClosures[index] = {
      ...newClosures[index],
      [field]: value
    };
    setClosures(newClosures);
  };

  const addClosureItem = () => {
    setClosures([...closures, {
      id: `xmas-${Date.now()}`,
      vendor: '',
      lastOrderDate: '',
      closingDate: '',
      openingDate: ''
    }]);
  };

  const removeClosureItem = (index: number) => {
    const newClosures = [...closures];
    newClosures.splice(index, 1);
    setClosures(newClosures);
  };

  const toggleOrderCompletion = (index: number) => {
    const newClosures = [...closures];
    newClosures[index] = {
      ...newClosures[index],
      finalOrderCompleted: !newClosures[index].finalOrderCompleted
    };
    setClosures(newClosures);
    // Auto-save when toggling completion
    localStorage.setItem('christmas_closures', JSON.stringify(newClosures));
  };

  // Sort closures: incomplete orders first, then completed ones (greyed out at bottom)
  const sortedClosures = [...closures].sort((a, b) => {
    if (a.finalOrderCompleted === b.finalOrderCompleted) return 0;
    return a.finalOrderCompleted ? 1 : -1;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 p-4">
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .page-container { max-width: 100% !important; padding: 0.5cm !important; }
          h1 { font-size: 20pt !important; margin-bottom: 0.5cm !important; }
          h2 { font-size: 14pt !important; margin: 0.3cm 0 0.2cm 0 !important; }
          table { font-size: 10pt !important; }
          .print-bg { background: white !important; border: 2px solid #dc2626 !important; }
          /* Show checkmark for completed items in print */
          input[type="checkbox"] {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border: 2px solid #166534;
            border-radius: 3px;
            position: relative;
          }
          input[type="checkbox"]:checked::after {
            content: '✓';
            position: absolute;
            top: -2px;
            left: 2px;
            font-size: 14pt;
            color: #166534;
            font-weight: bold;
          }
        }
      `}</style>

      <div className="max-w-6xl mx-auto page-container">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 no-print">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 via-green-600 to-red-600 bg-clip-text text-transparent">
            🎄 Christmas/New Year Supplier Closures
          </h1>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button onClick={handleSave} size="sm" className="bg-green-600 hover:bg-green-700">
                  💾 Save
                </Button>
                <Button onClick={() => setIsEditing(false)} size="sm" variant="outline">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
                  ✏️ Edit
                </Button>
                <Button onClick={handlePrint} size="sm" className="bg-red-600 hover:bg-red-700">
                  🖨️ Print
                </Button>
              </>
            )}
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-4 print:block hidden text-red-700">
          🎄 Christmas/New Year Supplier Closures
        </h1>

        {/* Period Info */}
        <div className="bg-gradient-to-r from-red-600 to-green-600 text-white rounded-lg p-4 mb-6 shadow-lg">
          <div className="text-center">
            <div className="text-2xl font-bold mb-1">December 2025 - January 2026</div>
            <div className="text-sm opacity-90">First 2 weeks of January included</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-4 border-red-200 print-bg">
          <div className="bg-gradient-to-r from-red-600 to-green-600 p-4">
            <h2 className="text-xl font-bold text-white text-center">
              Supplier Closure Schedule
            </h2>
          </div>

          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-red-100 to-green-100 border-b-2 border-red-300">
                    <th className="text-center py-3 px-3 font-bold text-green-700">✓ Ordered</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-800">Supplier</th>
                    <th className="text-left py-3 px-4 font-bold text-red-700">⚠️ Last Order Deadline</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Closing Date</th>
                    <th className="text-left py-3 px-4 font-bold text-green-700">✓ Opening Date</th>
                    <th className="text-left py-3 px-4 font-bold text-blue-700">🚚 Special Deliveries<br/><span className="text-xs font-normal">(during closure)</span></th>
                    {isEditing && <th className="py-3 px-4"></th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedClosures.length === 0 ? (
                    <tr>
                      <td colSpan={isEditing ? 7 : 6} className="text-center py-8 text-gray-500 italic">
                        No supplier closures added yet. Click "Edit" to add suppliers.
                      </td>
                    </tr>
                  ) : (
                    sortedClosures.map((item, index) => {
                      const isCompleted = item.finalOrderCompleted;
                      const rowClass = isCompleted
                        ? "border-b border-gray-200 bg-gray-100 opacity-60"
                        : "border-b border-gray-200 hover:bg-red-50 transition-colors";
                      const originalIndex = closures.findIndex(c => c.id === item.id);

                      return (
                        <tr key={item.id} className={rowClass}>
                          {/* Checkbox column */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isCompleted || false}
                              onChange={() => toggleOrderCompletion(originalIndex)}
                              className="w-5 h-5 cursor-pointer accent-green-600"
                              title="Mark final Christmas order as completed"
                            />
                          </td>
                          {isEditing ? (
                            <>
                              <td className="py-3 px-3">
                              <Input
                                value={item.vendor}
                                onChange={(e) => updateClosureItem(originalIndex, 'vendor', e.target.value)}
                                placeholder="Supplier name"
                                className="text-sm h-9"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <Input
                                value={item.lastOrderDate}
                                onChange={(e) => updateClosureItem(originalIndex, 'lastOrderDate', e.target.value)}
                                placeholder="e.g., 19 Dec"
                                className="text-sm h-9"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <Input
                                value={item.closingDate}
                                onChange={(e) => updateClosureItem(originalIndex, 'closingDate', e.target.value)}
                                placeholder="e.g., 22 Dec"
                                className="text-sm h-9"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <Input
                                value={item.openingDate}
                                onChange={(e) => updateClosureItem(originalIndex, 'openingDate', e.target.value)}
                                placeholder="e.g., 4 Jan"
                                className="text-sm h-9"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <div className="space-y-1">
                                <Input
                                  value={item.specialDelivery1 || ''}
                                  onChange={(e) => updateClosureItem(originalIndex, 'specialDelivery1', e.target.value)}
                                  placeholder="1st delivery (e.g., 30 Dec)"
                                  className="text-xs h-7"
                                />
                                <Input
                                  value={item.specialDelivery2 || ''}
                                  onChange={(e) => updateClosureItem(originalIndex, 'specialDelivery2', e.target.value)}
                                  placeholder="2nd delivery (optional)"
                                  className="text-xs h-7"
                                />
                                <Input
                                  value={item.specialDelivery3 || ''}
                                  onChange={(e) => updateClosureItem(originalIndex, 'specialDelivery3', e.target.value)}
                                  placeholder="3rd delivery (optional)"
                                  className="text-xs h-7"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <Button
                                onClick={() => removeClosureItem(originalIndex)}
                                variant="destructive"
                                size="sm"
                                className="h-9"
                              >
                                ✕ Remove
                              </Button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4 font-bold text-gray-900 text-base">{item.vendor}</td>
                            <td className="py-3 px-4 text-red-700 font-bold text-base">{item.lastOrderDate}</td>
                            <td className="py-3 px-4 text-gray-700 text-base">{item.closingDate}</td>
                            <td className="py-3 px-4 text-green-700 font-bold text-base">{item.openingDate}</td>
                            <td className="py-3 px-4 text-blue-700 text-base">
                              {item.specialDelivery1 || item.specialDelivery2 || item.specialDelivery3 ? (
                                <div className="space-y-1">
                                  {item.specialDelivery1 && (
                                    <div className="bg-blue-50 px-2 py-1 rounded border border-blue-200 font-semibold">
                                      📦 {item.specialDelivery1}
                                    </div>
                                  )}
                                  {item.specialDelivery2 && (
                                    <div className="bg-blue-50 px-2 py-1 rounded border border-blue-200 font-semibold">
                                      📦 {item.specialDelivery2}
                                    </div>
                                  )}
                                  {item.specialDelivery3 && (
                                    <div className="bg-blue-50 px-2 py-1 rounded border border-blue-200 font-semibold">
                                      📦 {item.specialDelivery3}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-sm">None</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {isEditing && (
              <div className="mt-4">
                <Button
                  onClick={addClosureItem}
                  variant="outline"
                  size="sm"
                  className="w-full border-2 border-dashed border-red-300 hover:border-red-500 hover:bg-red-50"
                >
                  + Add Supplier
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 no-print">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <div className="font-semibold text-yellow-900 mb-1">Important Notes:</div>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Plan your orders well in advance of the last order deadline</li>
                <li>• Stock up on essential items before suppliers close</li>
                <li>• Check with suppliers for any changes to their closure dates</li>
                <li>• Consider alternative suppliers for critical items during closure periods</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
