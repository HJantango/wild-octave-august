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

        {/* Weekly Grid - Screen View */}
        {weeklyData && (
          <div className="block print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
              {weeklyData.days.map((day, dayIndex) => (
                <Card key={day.date} className="break-inside-avoid">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold text-center">
                      {day.dayName}
                      <div className="text-sm font-normal text-gray-600">
                        {new Date(day.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {day.sections.map((section) => (
                      <div 
                        key={section.id}
                        className={`p-3 rounded-lg border ${getSectionColor(section.section)}`}
                      >
                        <div className="font-semibold text-sm mb-2 flex items-center gap-1">
                          <span>{getSectionIcon(section.section)}</span>
                          {section.name}
                        </div>
                        <div className="space-y-1">
                          {section.items.map((item) => (
                            <div 
                              key={item.id}
                              className="flex items-start gap-2 text-sm"
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
                                className="mt-1"
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
                      <div className="text-center text-gray-500 text-sm py-8">
                        No tasks for this day
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Print Layout - One Page Per Day */}
        {weeklyData && (
          <div className="hidden print:block">
            {weeklyData.days.map((day, dayIndex) => (
              <div 
                key={day.date} 
                className="page-break-before print-page"
                style={{ pageBreakBefore: dayIndex > 0 ? 'always' : 'auto' }}
              >
                {/* Day Header */}
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-bold mb-2">
                    {day.dayName}
                  </h2>
                  <div className="text-xl text-gray-700">
                    {new Date(day.date).toLocaleDateString('en-US', { 
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="text-lg mt-2 text-gray-600">
                    Week of {weeklyData.weekStart} to {weeklyData.weekEnd}
                  </div>
                </div>

                {/* Sections for this day */}
                <div className="space-y-8">
                  {day.sections.map((section) => (
                    <div key={section.id} className="border-2 border-gray-300 rounded-lg p-6">
                      {/* Section Header */}
                      <div className="bg-gray-100 -mx-6 -mt-6 mb-6 px-6 py-4 rounded-t-lg">
                        <h3 className="text-2xl font-bold flex items-center gap-3">
                          <span className="text-3xl">{getSectionIcon(section.section)}</span>
                          {section.name}
                        </h3>
                      </div>

                      {/* Task List */}
                      <div className="grid grid-cols-1 gap-4">
                        {section.items.map((item) => (
                          <div 
                            key={item.id}
                            className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg"
                          >
                            {/* Large checkbox */}
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-6 h-6 border-2 border-black rounded"></div>
                            </div>
                            
                            {/* Task content */}
                            <div className="flex-1">
                              <div className="text-lg font-medium">
                                {item.title}
                              </div>
                              {item.description && (
                                <div className="text-sm text-gray-600 mt-1">
                                  {item.description}
                                </div>
                              )}
                              {item.frequency === 'weekly' && item.specificDays?.length > 0 && (
                                <div className="text-sm text-blue-600 mt-1 font-medium">
                                  📅 Weekly: {item.specificDays.join(', ')}
                                </div>
                              )}
                            </div>

                            {/* Completion info */}
                            <div className="flex-shrink-0 w-32 text-right">
                              {item.completed && item.completedBy && (
                                <div>
                                  <div className="text-sm font-medium text-green-600">✓ Complete</div>
                                  <div className="text-xs text-gray-500">{item.completedBy}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {day.sections.length === 0 && (
                    <div className="text-center text-gray-500 text-xl py-16">
                      No tasks scheduled for this day
                    </div>
                  )}
                </div>

                {/* Day Footer */}
                <div className="mt-12 pt-6 border-t-2 border-gray-300 text-center text-sm text-gray-600">
                  <p>Wild Octave Organics - Daily Checklist - Page {dayIndex + 1} of 7</p>
                </div>
              </div>
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
          /* Page setup */
          @page {
            size: A4 portrait;
            margin: 1cm;
          }
          
          /* Global print settings */
          body { 
            print-color-adjust: exact; 
            -webkit-print-color-adjust: exact;
          }
          
          /* Page break handling */
          .print-page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .page-break-before {
            break-before: page;
            page-break-before: always;
          }
          
          /* Hide elements that shouldn't print */
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          
          /* Prevent breaking inside elements */
          .print-page > * {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          /* Ensure content doesn't overflow */
          * {
            max-width: 100% !important;
          }
          
          /* Typography for print */
          h1, h2, h3, h4, h5, h6 {
            font-weight: bold !important;
            color: black !important;
          }
          
          /* Border and box styling */
          .border, .border-2, .border-gray-300 {
            border: 2px solid #000 !important;
          }
          
          .border-gray-200 {
            border: 1px solid #666 !important;
          }
          
          .rounded, .rounded-lg {
            border-radius: 8px !important;
          }
          
          .rounded-t-lg {
            border-radius: 8px 8px 0 0 !important;
          }
          
          /* Background colors */
          .bg-gray-100 {
            background-color: #f5f5f5 !important;
          }
          
          /* Text colors */
          .text-gray-600, .text-gray-700 {
            color: #666 !important;
          }
          
          .text-gray-500 {
            color: #777 !important;
          }
          
          .text-blue-600 {
            color: #1e40af !important;
          }
          
          .text-green-600 {
            color: #16a34a !important;
          }
          
          /* Spacing */
          .space-y-8 > * + * { margin-top: 2rem !important; }
          .space-y-4 > * + * { margin-top: 1rem !important; }
          .gap-4 { gap: 1rem !important; }
          .gap-3 { gap: 0.75rem !important; }
          
          /* Padding and margin */
          .p-6 { padding: 1.5rem !important; }
          .p-4 { padding: 1rem !important; }
          .px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
          .py-4 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
          .pt-6 { padding-top: 1.5rem !important; }
          .pb-6 { padding-bottom: 1.5rem !important; }
          .mb-8 { margin-bottom: 2rem !important; }
          .mb-6 { margin-bottom: 1.5rem !important; }
          .mt-12 { margin-top: 3rem !important; }
          .mt-2 { margin-top: 0.5rem !important; }
          .mt-1 { margin-top: 0.25rem !important; }
          .-mx-6 { margin-left: -1.5rem !important; margin-right: -1.5rem !important; }
          .-mt-6 { margin-top: -1.5rem !important; }
          
          /* Flexbox */
          .flex { display: flex !important; }
          .flex-1 { flex: 1 1 0% !important; }
          .flex-shrink-0 { flex-shrink: 0 !important; }
          .items-start { align-items: flex-start !important; }
          .items-center { align-items: center !important; }
          .justify-center { justify-content: center !important; }
          .flex-col { flex-direction: column !important; }
          
          /* Grid */
          .grid { display: grid !important; }
          .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
          
          /* Text alignment */
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          
          /* Font sizes */
          .text-4xl { font-size: 2.25rem !important; line-height: 2.5rem !important; }
          .text-3xl { font-size: 1.875rem !important; line-height: 2.25rem !important; }
          .text-2xl { font-size: 1.5rem !important; line-height: 2rem !important; }
          .text-xl { font-size: 1.25rem !important; line-height: 1.75rem !important; }
          .text-lg { font-size: 1.125rem !important; line-height: 1.75rem !important; }
          .text-sm { font-size: 0.875rem !important; line-height: 1.25rem !important; }
          .text-xs { font-size: 0.75rem !important; line-height: 1rem !important; }
          
          /* Font weights */
          .font-bold { font-weight: 700 !important; }
          .font-medium { font-weight: 500 !important; }
          
          /* Width and height */
          .w-6 { width: 1.5rem !important; }
          .h-6 { height: 1.5rem !important; }
          .w-32 { width: 8rem !important; }
          
          /* Border styles */
          .border-t-2 { border-top: 2px solid #666 !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}