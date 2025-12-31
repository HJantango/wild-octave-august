'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ScheduleItem {
  id: string;
  vendor: string;
  description: string;
  frequency: string;
  contactMethod?: string;
}

interface DaySchedule {
  day: string;
  items: ScheduleItem[];
}

interface IncidentalItem {
  id: string;
  vendor: string;
  product: string;
  trigger: string;
  contactMethod: string;
}

const INITIAL_SCHEDULE: DaySchedule[] = [
  {
    day: 'Monday',
    items: [
      { id: 'mon-1', vendor: 'Byron Bay Gourmet Pies', description: 'Pies delivery', frequency: 'Twice weekly', contactMethod: 'Call/Order' }
    ]
  },
  {
    day: 'Tuesday',
    items: [
      { id: 'tue-1', vendor: 'Liz Jackson', description: 'Gluten free cakes', frequency: 'Weekly', contactMethod: 'Call/Order' }
    ]
  },
  {
    day: 'Wednesday',
    items: [
      { id: 'wed-1', vendor: 'Byron Bay Gourmet Pies', description: 'Pies delivery', frequency: 'Twice weekly', contactMethod: 'Call/Order' }
    ]
  },
  { day: 'Thursday', items: [] },
  { day: 'Friday', items: [] },
  { day: 'Saturday', items: [] },
  {
    day: 'Sunday',
    items: [
      { id: 'sun-1', vendor: 'Yummify (Arianne)', description: 'Savoury and sweet', frequency: 'Weekly', contactMethod: 'Call/Order' }
    ]
  }
];

const INITIAL_FORTNIGHTLY: DaySchedule[] = [
  { day: 'Monday', items: [] },
  { day: 'Tuesday', items: [] },
  { day: 'Wednesday', items: [] },
  { day: 'Thursday', items: [] },
  {
    day: 'Friday',
    items: [
      { id: 'fort-fri-1', vendor: 'Byron Bay Brownies', description: 'Brownies', frequency: 'Fortnightly', contactMethod: 'She calls' }
    ]
  },
  { day: 'Saturday', items: [] },
  {
    day: 'Sunday',
    items: [
      { id: 'fort-sun-1', vendor: 'Gigis', description: 'Vegan sweets', frequency: 'Fortnightly', contactMethod: 'Email' },
      { id: 'fort-sun-2', vendor: 'Zenfelds', description: 'Coffee', frequency: 'Fortnightly', contactMethod: 'Call/Order' }
    ]
  }
];

const INITIAL_INCIDENTALS: IncidentalItem[] = [
  { id: 'inc-1', vendor: 'Marlena', product: 'Samosas', trigger: 'When needed', contactMethod: 'Text' },
  { id: 'inc-2', vendor: 'Spiral Foods / Santos / Horizon', product: 'Milks for café', trigger: 'When down to 2', contactMethod: 'Tell Jackie' },
  { id: 'inc-3', vendor: 'Blue Bay Gourmet', product: 'Frozen Mango / Berries', trigger: 'When needed', contactMethod: 'Next day delivery' },
  { id: 'inc-4', vendor: 'All Good Foods', product: 'Acaii', trigger: 'When needed', contactMethod: 'Notify Jackie' },
  { id: 'inc-5', vendor: 'David Dahl', product: 'Product', trigger: 'When down to last bucket', contactMethod: 'Call, then text' },
  { id: 'inc-6', vendor: 'David', product: 'Mango Chutney', trigger: 'When down to 1 or 2 jars', contactMethod: 'Call' }
];

export default function CafeSchedulePage() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(INITIAL_SCHEDULE);
  const [fortnightly, setFortnightly] = useState<DaySchedule[]>(INITIAL_FORTNIGHTLY);
  const [incidentals, setIncidentals] = useState<IncidentalItem[]>(INITIAL_INCIDENTALS);
  const [isEditing, setIsEditing] = useState(false);
  const [colorPrint, setColorPrint] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('cafe_schedule');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.schedule) setSchedule(parsed.schedule);
        if (parsed.fortnightly) setFortnightly(parsed.fortnightly);
        if (parsed.incidentals) setIncidentals(parsed.incidentals);
      } catch (e) {
        console.error('Failed to load saved schedule:', e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('cafe_schedule', JSON.stringify({
      schedule,
      fortnightly,
      incidentals
    }));
    setIsEditing(false);
    alert('Schedule saved!');
  };

  const handlePrint = () => {
    window.print();
  };

  const updateScheduleItem = (dayIndex: number, itemIndex: number, field: keyof ScheduleItem, value: string) => {
    const newSchedule = [...schedule];
    newSchedule[dayIndex].items[itemIndex] = {
      ...newSchedule[dayIndex].items[itemIndex],
      [field]: value
    };
    setSchedule(newSchedule);
  };

  const addScheduleItem = (dayIndex: number) => {
    const newSchedule = [...schedule];
    newSchedule[dayIndex].items.push({
      id: `${schedule[dayIndex].day.toLowerCase()}-${Date.now()}`,
      vendor: '',
      description: '',
      frequency: '',
      contactMethod: ''
    });
    setSchedule(newSchedule);
  };

  const removeScheduleItem = (dayIndex: number, itemIndex: number) => {
    const newSchedule = [...schedule];
    newSchedule[dayIndex].items.splice(itemIndex, 1);
    setSchedule(newSchedule);
  };

  const updateFortnightlyItem = (dayIndex: number, itemIndex: number, field: keyof ScheduleItem, value: string) => {
    const newFortnightly = [...fortnightly];
    newFortnightly[dayIndex].items[itemIndex] = {
      ...newFortnightly[dayIndex].items[itemIndex],
      [field]: value
    };
    setFortnightly(newFortnightly);
  };

  const addFortnightlyItem = (dayIndex: number) => {
    const newFortnightly = [...fortnightly];
    newFortnightly[dayIndex].items.push({
      id: `fort-${fortnightly[dayIndex].day.toLowerCase()}-${Date.now()}`,
      vendor: '',
      description: '',
      frequency: 'Fortnightly',
      contactMethod: ''
    });
    setFortnightly(newFortnightly);
  };

  const removeFortnightlyItem = (dayIndex: number, itemIndex: number) => {
    const newFortnightly = [...fortnightly];
    newFortnightly[dayIndex].items.splice(itemIndex, 1);
    setFortnightly(newFortnightly);
  };

  const updateIncidentalItem = (index: number, field: keyof IncidentalItem, value: string) => {
    const newIncidentals = [...incidentals];
    newIncidentals[index] = {
      ...newIncidentals[index],
      [field]: value
    };
    setIncidentals(newIncidentals);
  };

  const addIncidentalItem = () => {
    setIncidentals([...incidentals, {
      id: `inc-${Date.now()}`,
      vendor: '',
      product: '',
      trigger: '',
      contactMethod: ''
    }]);
  };

  const removeIncidentalItem = (index: number) => {
    const newIncidentals = [...incidentals];
    newIncidentals.splice(index, 1);
    setIncidentals(newIncidentals);
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .page-container { max-width: 100% !important; padding: 0.5cm !important; }
          .calendar-grid { gap: 0.3cm !important; }
          .day-cell { page-break-inside: avoid; }
          h1 { font-size: 20pt !important; margin-bottom: 0.3cm !important; }
          h2 { font-size: 14pt !important; margin: 0.3cm 0 0.2cm 0 !important; }
          table { font-size: 9pt !important; }

          ${colorPrint ? `
            /* Pastel Color Print Styles */
            .weekly-header {
              background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%) !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .weekly-day-header {
              background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%) !important;
              color: #374151 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .weekly-item {
              background: #fef3c7 !important;
              border-color: #fcd34d !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .fortnightly-header {
              background: linear-gradient(135deg, #d4a5ff 0%, #a78bfa 100%) !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .fortnightly-day-header {
              background: linear-gradient(135deg, #c7d2fe 0%, #ddd6fe 100%) !important;
              color: #374151 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .fortnightly-item {
              background: #e9d5ff !important;
              border-color: #c084fc !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .incidentals-header {
              background: linear-gradient(135deg, #fed7aa 0%, #fca5a5 100%) !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .incidentals-table-header {
              background: #fef3c7 !important;
              border-color: #fbbf24 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .incidentals-row:hover, .incidentals-row {
              background: white !important;
            }
            .incidentals-row:nth-child(even) {
              background: #fef3c7 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          ` : `
            /* Black & White Print Styles */
            .bg-gradient-to-r, .bg-gradient-to-br {
              background: white !important;
              color: black !important;
            }
            .weekly-item, .fortnightly-item {
              background: white !important;
              border: 1px solid #e5e7eb !important;
            }
          `}
        }
      `}</style>

      <div className="max-w-7xl mx-auto page-container">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 no-print">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
            ☕ Cafe Ordering Schedule
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
                <Button
                  onClick={() => setColorPrint(!colorPrint)}
                  size="sm"
                  variant="outline"
                  className={colorPrint ? "border-purple-400 bg-purple-50" : ""}
                >
                  {colorPrint ? "🎨 Color Print" : "⬛ B&W Print"}
                </Button>
                <Button onClick={handlePrint} size="sm" className="bg-blue-600 hover:bg-blue-700">
                  🖨️ Print
                </Button>
              </>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-3 print:block hidden">☕ Cafe Ordering Schedule</h1>

        {/* Weekly Calendar - Compact Grid */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-md text-sm weekly-header">
              📅 Weekly Schedule
            </span>
          </h2>
          <div className="grid grid-cols-7 gap-2 calendar-grid">
            {schedule.map((daySchedule, dayIndex) => (
              <div key={daySchedule.day} className="border-2 border-gray-200 rounded-lg overflow-hidden day-cell bg-white shadow-sm">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-center py-1.5 font-bold text-sm weekly-day-header">
                  {daySchedule.day.slice(0, 3)}
                </div>
                <div className="p-2 min-h-[100px]">
                  {daySchedule.items.map((item, itemIndex) => (
                    <div key={item.id} className="mb-2 last:mb-0">
                      {isEditing ? (
                        <div className="space-y-1">
                          <Input
                            value={item.vendor}
                            onChange={(e) => updateScheduleItem(dayIndex, itemIndex, 'vendor', e.target.value)}
                            placeholder="Vendor"
                            className="text-xs h-6 p-1"
                          />
                          <Input
                            value={item.description}
                            onChange={(e) => updateScheduleItem(dayIndex, itemIndex, 'description', e.target.value)}
                            placeholder="Description"
                            className="text-xs h-6 p-1"
                          />
                          <Button
                            onClick={() => removeScheduleItem(dayIndex, itemIndex)}
                            variant="destructive"
                            size="sm"
                            className="w-full h-5 text-xs"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-rose-50 rounded p-1.5 border border-rose-200 weekly-item">
                          <div className="font-semibold text-xs text-gray-900 leading-tight">{item.vendor}</div>
                          <div className="text-[10px] text-gray-600 leading-tight mt-0.5">{item.description}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      onClick={() => addScheduleItem(dayIndex)}
                      variant="outline"
                      size="sm"
                      className="w-full h-6 text-xs mt-1"
                    >
                      + Add
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fortnightly Calendar */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
            <span className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1 rounded-md text-sm fortnightly-header">
              🔄 Fortnightly Orders
            </span>
          </h2>
          <div className="grid grid-cols-7 gap-2 calendar-grid">
            {fortnightly.map((daySchedule, dayIndex) => (
              <div key={daySchedule.day} className="border-2 border-gray-200 rounded-lg overflow-hidden day-cell bg-white shadow-sm">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-center py-1.5 font-bold text-sm fortnightly-day-header">
                  {daySchedule.day.slice(0, 3)}
                </div>
                <div className="p-2 min-h-[100px]">
                  {daySchedule.items.map((item, itemIndex) => (
                    <div key={item.id} className="mb-2 last:mb-0">
                      {isEditing ? (
                        <div className="space-y-1">
                          <Input
                            value={item.vendor}
                            onChange={(e) => updateFortnightlyItem(dayIndex, itemIndex, 'vendor', e.target.value)}
                            placeholder="Vendor"
                            className="text-xs h-6 p-1"
                          />
                          <Input
                            value={item.description}
                            onChange={(e) => updateFortnightlyItem(dayIndex, itemIndex, 'description', e.target.value)}
                            placeholder="Description"
                            className="text-xs h-6 p-1"
                          />
                          <Button
                            onClick={() => removeFortnightlyItem(dayIndex, itemIndex)}
                            variant="destructive"
                            size="sm"
                            className="w-full h-5 text-xs"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-purple-50 rounded p-1.5 border border-purple-200 fortnightly-item">
                          <div className="font-semibold text-xs text-gray-900 leading-tight">{item.vendor}</div>
                          <div className="text-[10px] text-gray-600 leading-tight mt-0.5">{item.description}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      onClick={() => addFortnightlyItem(dayIndex)}
                      variant="outline"
                      size="sm"
                      className="w-full h-6 text-xs mt-1"
                    >
                      + Add
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Incidentals */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
            <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded-md text-sm incidentals-header">
              📦 Order When Needed
            </span>
          </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300 incidentals-table-header">
                    <th className="text-left py-1 px-2 font-semibold">Vendor</th>
                    <th className="text-left py-1 px-2 font-semibold">Product</th>
                    <th className="text-left py-1 px-2 font-semibold">Trigger</th>
                    <th className="text-left py-1 px-2 font-semibold">Contact</th>
                    {isEditing && <th className="py-1 px-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {incidentals.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-200 hover:bg-orange-50 incidentals-row">
                      {isEditing ? (
                        <>
                          <td className="py-1 px-1">
                            <Input
                              value={item.vendor}
                              onChange={(e) => updateIncidentalItem(index, 'vendor', e.target.value)}
                              className="text-xs h-6 p-1"
                            />
                          </td>
                          <td className="py-1 px-1">
                            <Input
                              value={item.product}
                              onChange={(e) => updateIncidentalItem(index, 'product', e.target.value)}
                              className="text-xs h-6 p-1"
                            />
                          </td>
                          <td className="py-1 px-1">
                            <Input
                              value={item.trigger}
                              onChange={(e) => updateIncidentalItem(index, 'trigger', e.target.value)}
                              className="text-xs h-6 p-1"
                            />
                          </td>
                          <td className="py-1 px-1">
                            <Input
                              value={item.contactMethod}
                              onChange={(e) => updateIncidentalItem(index, 'contactMethod', e.target.value)}
                              className="text-xs h-6 p-1"
                            />
                          </td>
                          <td className="py-1 px-1">
                            <Button
                              onClick={() => removeIncidentalItem(index)}
                              variant="destructive"
                              size="sm"
                              className="h-6 text-xs"
                            >
                              ✕
                            </Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-1.5 px-2 font-medium">{item.vendor}</td>
                          <td className="py-1.5 px-2 text-gray-700">{item.product}</td>
                          <td className="py-1.5 px-2 text-gray-600">{item.trigger}</td>
                          <td className="py-1.5 px-2 text-gray-500 italic">{item.contactMethod}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {isEditing && (
                <Button onClick={addIncidentalItem} variant="outline" size="sm" className="w-full mt-2 h-7 text-xs">
                  + Add Incidental
                </Button>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
