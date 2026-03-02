'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  frequency: string;
  specificDays: string[];
  completed?: boolean;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
}

interface ChecklistSection {
  id: string;
  name: string;
  section: string;
  items: ChecklistItem[];
}

interface WeeklyDay {
  date: string;
  dayName: string;
  sections: ChecklistSection[];
}

export default function ChecklistsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<{ days: WeeklyDay[]; weekStart: string; weekEnd: string } | null>(null);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // Get Monday of current week
  const getMondayOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  };

  const loadWeeklyChecklists = async (weekStart: Date) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        weekStart: weekStart.toISOString().split('T')[0],
      });
      
      if (selectedSection !== 'all') {
        params.append('section', selectedSection);
      }

      const response = await fetch(`/api/checklists/weekly?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setWeeklyData(data.data);
      } else {
        toast.error('Error', 'Failed to load checklists');
      }
    } catch (error) {
      toast.error('Error', 'Failed to load checklists');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompletion = async (itemId: string, date: string, completed: boolean, completedBy?: string) => {
    try {
      if (completed) {
        // Mark as incomplete
        await fetch('/api/checklists/complete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, date }),
        });
      } else {
        // Mark as complete
        const staffName = prompt('Who completed this task?') || 'Unknown';
        await fetch('/api/checklists/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            itemId, 
            date, 
            completedBy: staffName,
            notes: ''
          }),
        });
      }
      
      // Reload data
      loadWeeklyChecklists(getMondayOfWeek(currentWeek));
      
    } catch (error) {
      toast.error('Error', 'Failed to update task');
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
    loadWeeklyChecklists(getMondayOfWeek(newWeek));
  };

  const printWeek = () => {
    window.print();
  };

  useEffect(() => {
    const monday = getMondayOfWeek(currentWeek);
    loadWeeklyChecklists(monday);
  }, [selectedSection]);

  const getSectionColor = (section: string) => {
    switch (section) {
      case 'kitchen': return 'bg-red-50 border-red-200';
      case 'front': return 'bg-blue-50 border-blue-200';  
      case 'barista': return 'bg-green-50 border-green-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getSectionIcon = (section: string) => {
    switch (section) {
      case 'kitchen': return '🍳';
      case 'front': return '🏪';
      case 'barista': return '☕';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 print:space-y-4">
        {/* Header - Hidden in print */}
        <div className="print:hidden">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white">
            <h1 className="text-3xl font-bold mb-2">📋 Shop Checklists</h1>
            <p className="text-blue-100">
              Daily and weekly task management for shop operations
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-4">
              <Button 
                onClick={() => navigateWeek('prev')}
                variant="outline"
              >
                ← Previous Week
              </Button>
              
              <div className="text-center">
                <div className="font-semibold">
                  {weeklyData?.weekStart} to {weeklyData?.weekEnd}
                </div>
              </div>
              
              <Button 
                onClick={() => navigateWeek('next')}
                variant="outline"
              >
                Next Week →
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <select 
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">All Sections</option>
                <option value="kitchen">Kitchen / Back</option>
                <option value="front">Front of House</option>
                <option value="barista">Barista</option>
              </select>

              <Button onClick={printWeek} variant="outline">
                🖨️ Print Week
              </Button>
            </div>
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-3xl font-bold">Wild Octave Organics - Weekly Checklist</h1>
          <div className="text-lg mt-2">
            Week of {weeklyData?.weekStart} to {weeklyData?.weekEnd}
          </div>
        </div>

        {/* Weekly Grid */}
        {weeklyData && (
          <div className="grid grid-cols-1 print:grid-cols-7 gap-4 print:gap-2">
            {weeklyData.days.map((day, dayIndex) => (
              <Card 
                key={day.date} 
                className={`print:break-inside-avoid print:shadow-none ${
                  dayIndex === 6 ? 'print:border-r-0' : ''
                }`}
              >
                <CardHeader className="pb-2 print:pb-1">
                  <CardTitle className="text-lg print:text-sm font-bold text-center">
                    {day.dayName}
                    <div className="text-sm print:text-xs font-normal text-gray-600">
                      {new Date(day.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 print:space-y-2">
                  {day.sections.map((section) => (
                    <div 
                      key={section.id}
                      className={`p-3 print:p-2 rounded-lg border ${getSectionColor(section.section)}`}
                    >
                      <div className="font-semibold text-sm print:text-xs mb-2 flex items-center gap-1">
                        <span>{getSectionIcon(section.section)}</span>
                        {section.name}
                      </div>
                      <div className="space-y-1">
                        {section.items.map((item) => (
                          <div 
                            key={item.id}
                            className="flex items-start gap-2 text-sm print:text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={item.completed || false}
                              onChange={(e) => toggleCompletion(
                                item.id, 
                                day.date, 
                                item.completed || false,
                                item.completedBy
                              )}
                              className="mt-1 print:accent-black"
                            />
                            <div className="flex-1">
                              <div className={item.completed ? 'line-through text-gray-500' : ''}>
                                {item.title}
                              </div>
                              {item.completed && item.completedBy && (
                                <div className="text-xs text-gray-500">
                                  ✓ {item.completedBy}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {day.sections.length === 0 && (
                    <div className="text-center text-gray-500 text-sm print:text-xs py-8">
                      No tasks for this day
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer for print */}
        <div className="hidden print:block mt-8 pt-4 border-t-2 border-black text-center text-xs">
          <p>Wild Octave Organics - {new Date().toLocaleDateString()}</p>
        </div>
      </div>
      
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { print-color-adjust: exact; }
          .print\\:grid-cols-7 { grid-template-columns: repeat(7, minmax(0, 1fr)) !important; }
          .print\\:text-xs { font-size: 0.75rem !important; }
          .print\\:text-sm { font-size: 0.875rem !important; }
          .print\\:space-y-1 > * + * { margin-top: 0.25rem !important; }
          .print\\:space-y-2 > * + * { margin-top: 0.5rem !important; }
          .print\\:p-1 { padding: 0.25rem !important; }
          .print\\:p-2 { padding: 0.5rem !important; }
          .print\\:pb-1 { padding-bottom: 0.25rem !important; }
          .print\\:gap-2 { gap: 0.5rem !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid !important; }
          .print\\:border-r-0 { border-right: 0 !important; }
          .print\\:accent-black { accent-color: black !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}