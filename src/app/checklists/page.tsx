'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import './print.css';

interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  frequency: string;
  specificDays: string[];
  sort_order: number;
  completed?: boolean;
  completedBy?: string;
}

interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  section: string;
  items: ChecklistItem[];
}

interface DaySection {
  id: string;
  name: string;
  section: string;
  items: ChecklistItem[];
}

interface DayData {
  date: string;
  dayName: string;
  sections: DaySection[];
}

interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  days: DayData[];
}

const getSectionIcon = (section: string) => {
  const icons: { [key: string]: string } = {
    kitchen: '🍳',
    front: '🏪',
    barista: '☕'
  };
  return icons[section] || '📋';
};

const getSectionName = (section: string) => {
  const names: { [key: string]: string } = {
    kitchen: 'Kitchen & Back Tasks',
    front: 'Front of House Tasks',
    barista: 'Barista Tasks'
  };
  return names[section] || section;
};

export default function ChecklistsPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [newTaskTemplate, setNewTaskTemplate] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Try main API first, fallback to simple API
      let response = await fetch('/api/checklists');
      
      if (!response.ok) {
        console.log('Main API failed, trying simple API...');
        response = await fetch('/api/checklists/simple');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setTemplates(data.data);
        buildWeeklyData(data.data);
      } else {
        toast.error('Error', 'Failed to load checklists');
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Error', 'Failed to load checklists');
    } finally {
      setLoading(false);
    }
  };

  const buildWeeklyData = (templates: ChecklistTemplate[]) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday

    const weeklyData: WeeklyData = {
      weekStart: startOfWeek.toISOString().split('T')[0],
      weekEnd: new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      days: []
    };

    // Build 7 days
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const sections: DaySection[] = [];

      // Process each template/section
      templates.forEach(template => {
        const sectionItems: ChecklistItem[] = [];

        template.items.forEach(item => {
          let shouldInclude = false;

          if (item.frequency === 'daily') {
            shouldInclude = true;
          } else if (item.frequency === 'weekly' && item.specificDays?.length > 0) {
            shouldInclude = item.specificDays.includes(dayName);
          }

          if (shouldInclude) {
            sectionItems.push(item);
          }
        });

        if (sectionItems.length > 0) {
          sections.push({
            id: template.id,
            name: getSectionName(template.section),
            section: template.section,
            items: sectionItems
          });
        }
      });

      weeklyData.days.push({
        date: currentDate.toISOString().split('T')[0],
        dayName,
        sections
      });
    }

    setWeeklyData(weeklyData);
  };

  const saveItem = async (templateId: string, item: ChecklistItem) => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      const updatedItems = template.items.map(i => i.id === item.id ? item : i);
      const updatedTemplate = { ...template, items: updatedItems };

      const response = await fetch(`/api/checklists/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTemplate),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Success', 'Task updated successfully');
        loadData();
      } else {
        toast.error('Error', data.error?.message || 'Failed to save task');
      }
    } catch (error) {
      toast.error('Error', 'Failed to save task');
    }
  };

  const addNewTask = async (templateId: string) => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      const newItem: ChecklistItem = {
        id: `new_${Date.now()}`,
        title: 'New Task',
        description: '',
        frequency: 'daily',
        specificDays: [],
        sort_order: template.items.length + 1
      };

      const updatedTemplate = { 
        ...template, 
        items: [...template.items, newItem] 
      };

      const response = await fetch(`/api/checklists/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTemplate),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Success', 'Task added successfully');
        loadData();
      } else {
        toast.error('Error', data.error?.message || 'Failed to add task');
      }
    } catch (error) {
      toast.error('Error', 'Failed to add task');
    }
  };

  const deleteTask = async (templateId: string, itemId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      const updatedItems = template.items.filter(i => i.id !== itemId);
      const updatedTemplate = { ...template, items: updatedItems };

      const response = await fetch(`/api/checklists/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTemplate),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Success', 'Task deleted successfully');
        loadData();
      } else {
        toast.error('Error', data.error?.message || 'Failed to delete task');
      }
    } catch (error) {
      toast.error('Error', 'Failed to delete task');
    }
  };

  const printWeek = () => {
    window.print();
  };

  useEffect(() => {
    loadData();
  }, []);

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
      <div className="space-y-6 print:space-y-0">
        {/* Header - Hidden in Print */}
        <div className="print:hidden bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">📋 Weekly Checklists</h1>
          <p className="text-purple-100">
            Manage your shop tasks and print daily checklists
          </p>
        </div>

        {/* Controls - Hidden in Print */}
        <div className="print:hidden flex gap-4 justify-center">
          <Button onClick={printWeek} className="bg-blue-600 hover:bg-blue-700">
            🖨️ Print Week (7 Pages)
          </Button>
        </div>

        {/* Screen Layout - Hidden in Print */}
        <div className="print:hidden">
          {templates.map((template) => (
            <Card key={template.id} className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{getSectionIcon(template.section)}</span>
                    {editingTemplate === template.id ? (
                      <input
                        type="text"
                        value={template.name}
                        onChange={(e) => {
                          const updated = templates.map(t => 
                            t.id === template.id ? { ...t, name: e.target.value } : t
                          );
                          setTemplates(updated);
                        }}
                        onBlur={() => {
                          saveItem(template.id, template.items[0]); // Trigger save
                          setEditingTemplate(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveItem(template.id, template.items[0]);
                            setEditingTemplate(null);
                          }
                        }}
                        className="text-lg font-semibold bg-transparent border-b border-gray-300"
                        autoFocus
                      />
                    ) : (
                      <span 
                        onClick={() => setEditingTemplate(template.id)}
                        className="cursor-pointer hover:text-blue-600"
                      >
                        {template.name}
                      </span>
                    )}
                  </div>
                  <Button 
                    onClick={() => addNewTask(template.id)}
                    size="sm"
                    variant="outline"
                  >
                    ➕ Add Task
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {template.items.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        {editingItem === item.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => {
                                const updated = templates.map(t => 
                                  t.id === template.id 
                                    ? { ...t, items: t.items.map(i => i.id === item.id ? { ...i, title: e.target.value } : i) }
                                    : t
                                );
                                setTemplates(updated);
                              }}
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
                            <div className="flex gap-2">
                              <select
                                value={item.frequency}
                                onChange={(e) => {
                                  const updated = templates.map(t => 
                                    t.id === template.id 
                                      ? { ...t, items: t.items.map(i => i.id === item.id ? { ...i, frequency: e.target.value } : i) }
                                      : t
                                  );
                                  setTemplates(updated);
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                              </select>
                              {item.frequency === 'weekly' && (
                                <div className="flex gap-1 text-xs">
                                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                    <label key={day} className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={item.specificDays.includes(day)}
                                        onChange={(e) => {
                                          const days = e.target.checked
                                            ? [...item.specificDays, day]
                                            : item.specificDays.filter(d => d !== day);
                                          const updated = templates.map(t => 
                                            t.id === template.id 
                                              ? { ...t, items: t.items.map(i => i.id === item.id ? { ...i, specificDays: days } : i) }
                                              : t
                                          );
                                          setTemplates(updated);
                                        }}
                                      />
                                      <span className="ml-1">{day.slice(0,3)}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => setEditingItem(item.id)}
                            className="cursor-pointer"
                          >
                            <div className="font-medium">{item.title}</div>
                            <div className="text-sm text-gray-500">
                              {item.frequency === 'daily' ? 'Every day' : 
                               item.frequency === 'weekly' && item.specificDays?.length > 0 ? 
                                 `Weekly: ${item.specificDays.join(', ')}` : 
                                 item.frequency}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {editingItem === item.id ? (
                          <>
                            <Button 
                              onClick={() => {
                                saveItem(template.id, item);
                                setEditingItem(null);
                              }}
                              size="sm"
                            >
                              ✓
                            </Button>
                            <Button 
                              onClick={() => setEditingItem(null)}
                              size="sm" 
                              variant="outline"
                            >
                              ✕
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              onClick={() => setEditingItem(item.id)}
                              size="sm" 
                              variant="outline"
                            >
                              ✏️
                            </Button>
                            <Button 
                              onClick={() => deleteTask(template.id, item.id)}
                              size="sm" 
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                            >
                              🗑️
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Print Layout - One Page Per Day */}
        {weeklyData && (
          <div className="hidden print:block">
            {weeklyData.days.map((day, dayIndex) => (
              <div key={day.date} className="print-day-page">
                {/* Day Header */}
                <div className="print-day-header">
                  <h1 className="print-day-title">
                    {day.dayName}
                  </h1>
                  <div className="print-day-date">
                    {new Date(day.date).toLocaleDateString('en-US', { 
                      year: 'numeric',
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>

                {/* Sections */}
                {day.sections.map((section) => (
                  <div key={section.id} className="print-section">
                    <div className="print-section-header">
                      <h2 className="print-section-title">
                        {getSectionIcon(section.section)} {section.name}
                      </h2>
                    </div>

                    {/* Tasks */}
                    {section.items.map((item) => (
                      <div key={item.id} className="print-task">
                        <div className="print-checkbox"></div>
                        <div className="print-task-content">
                          <div className="print-task-title">
                            {item.title}
                          </div>
                          {item.description && (
                            <div className="print-task-description">
                              {item.description}
                            </div>
                          )}
                          {item.frequency === 'weekly' && item.specificDays?.length > 0 && (
                            <div className="print-task-schedule">
                              📅 {item.specificDays.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                
                {day.sections.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#999', fontSize: '18px', padding: '60px 0' }}>
                    No tasks scheduled for this day
                  </div>
                )}

                {/* Footer */}
                <div className="print-footer">
                  Wild Octave Organics - {day.dayName} - Page {dayIndex + 1} of 7
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}