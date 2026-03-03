'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface ChecklistItem {
  id?: string;
  title: string;
  description?: string;
  frequency: string;
  specific_days?: string[];
  specificDays: string[];
  sort_order?: number;
}

interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  section: string;
  items: ChecklistItem[];
}

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'specific_days', label: 'Specific Days' },
];

const SECTION_OPTIONS = [
  { value: 'kitchen', label: 'Kitchen / Back', icon: '🍳' },
  { value: 'front', label: 'Front of House', icon: '🏪' },
  { value: 'barista', label: 'Barista', icon: '☕' },
];

export default function ManageChecklistsPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/checklists');
      const data = await response.json();
      
      if (data.success) {
        // Convert weekly items with specific days to 'specific_days' frequency for editing
        const convertedTemplates = data.data.map((template: ChecklistTemplate) => ({
          ...template,
          items: template.items.map(item => ({
            ...item,
            frequency: item.frequency === 'weekly' && item.specificDays?.length > 0 
              ? 'specific_days' 
              : item.frequency
          }))
        }));
        setTemplates(convertedTemplates);
      } else {
        toast.error('Error', 'Failed to load checklists');
      }
    } catch (error) {
      toast.error('Error', 'Failed to load checklists');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (template: ChecklistTemplate) => {
    setEditingTemplate(JSON.parse(JSON.stringify(template)));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditingTemplate(null);
    setIsEditing(false);
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const url = editingTemplate.id.startsWith('new-') 
        ? '/api/checklists' 
        : `/api/checklists/${editingTemplate.id}`;
      const method = editingTemplate.id.startsWith('new-') ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplate),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Success', 'Checklist saved successfully');
        cancelEditing();
        loadTemplates();
      } else {
        toast.error('Error', data.error?.message || 'Failed to save checklist');
      }
    } catch (error) {
      toast.error('Error', 'Failed to save checklist');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this checklist?')) return;

    try {
      const response = await fetch(`/api/checklists/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Success', 'Checklist deleted successfully');
        loadTemplates();
      } else {
        toast.error('Error', data.error?.message || 'Failed to delete checklist');
      }
    } catch (error) {
      toast.error('Error', 'Failed to delete checklist');
    }
  };

  const addNewTemplate = () => {
    const newTemplate: ChecklistTemplate = {
      id: `new-${Date.now()}`,
      name: '',
      description: '',
      section: 'front',
      items: [],
    };
    setEditingTemplate(newTemplate);
    setIsEditing(true);
  };

  const addItem = () => {
    if (!editingTemplate) return;
    
    const newItem: ChecklistItem = {
      title: '',
      frequency: 'daily',
      specificDays: [],
    };
    
    setEditingTemplate({
      ...editingTemplate,
      items: [...editingTemplate.items, newItem],
    });
  };

  const updateItem = (index: number, field: keyof ChecklistItem, value: any) => {
    if (!editingTemplate) return;
    
    const updatedItems = [...editingTemplate.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    setEditingTemplate({
      ...editingTemplate,
      items: updatedItems,
    });
  };

  const removeItem = (index: number) => {
    if (!editingTemplate) return;
    
    const updatedItems = editingTemplate.items.filter((_, i) => i !== index);
    
    setEditingTemplate({
      ...editingTemplate,
      items: updatedItems,
    });
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (!editingTemplate) return;
    
    const items = [...editingTemplate.items];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= items.length) return;
    
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    
    setEditingTemplate({
      ...editingTemplate,
      items,
    });
  };

  useEffect(() => {
    loadTemplates();
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
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">⚙️ Manage Checklists</h1>
          <p className="text-purple-100">
            Edit and customize your shop checklists
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center">
          <Button onClick={addNewTemplate} className="bg-green-600 hover:bg-green-700">
            ➕ Add New Checklist
          </Button>
          <Button 
            onClick={() => window.location.href = '/checklists'} 
            variant="outline"
          >
            📋 View Weekly Checklists
          </Button>
        </div>

        {/* Templates List */}
        {!isEditing && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => {
              const sectionInfo = SECTION_OPTIONS.find(s => s.value === template.section);
              return (
                <Card key={template.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span>{sectionInfo?.icon || '📋'}</span>
                      {template.name}
                    </CardTitle>
                    {template.description && (
                      <p className="text-sm text-gray-600">{template.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-gray-500">
                        {template.items.length} tasks
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => startEditing(template)}
                          variant="outline"
                          size="sm"
                        >
                          ✏️ Edit
                        </Button>
                        <Button 
                          onClick={() => deleteTemplate(template.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          🗑️ Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Edit Form */}
        {isEditing && editingTemplate && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingTemplate.id.startsWith('new-') ? 'Create New Checklist' : 'Edit Checklist'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Template Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      name: e.target.value,
                    })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="e.g., Kitchen Daily Tasks"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Section</label>
                  <select
                    value={editingTemplate.section}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      section: e.target.value,
                    })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {SECTION_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.icon} {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editingTemplate.description || ''}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    description: e.target.value,
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                  placeholder="Optional description..."
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Tasks</h3>
                  <Button onClick={addItem} size="sm" variant="outline">
                    ➕ Add Task
                  </Button>
                </div>

                <div className="space-y-4">
                  {editingTemplate.items.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Task Name</label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateItem(index, 'title', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            placeholder="Task description..."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">Frequency</label>
                          <select
                            value={item.frequency}
                            onChange={(e) => updateItem(index, 'frequency', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                          >
                            {FREQUENCY_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-end gap-2">
                          <Button 
                            onClick={() => moveItem(index, 'up')} 
                            disabled={index === 0}
                            size="sm" 
                            variant="outline"
                          >
                            ↑
                          </Button>
                          <Button 
                            onClick={() => moveItem(index, 'down')} 
                            disabled={index === editingTemplate.items.length - 1}
                            size="sm" 
                            variant="outline"
                          >
                            ↓
                          </Button>
                          <Button 
                            onClick={() => removeItem(index)}
                            size="sm" 
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                          >
                            🗑️
                          </Button>
                        </div>
                      </div>

                      {item.frequency === 'specific_days' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium mb-2">Specific Days</label>
                          <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map(day => (
                              <label key={day} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={item.specificDays.includes(day)}
                                  onChange={(e) => {
                                    const days = e.target.checked
                                      ? [...item.specificDays, day]
                                      : item.specificDays.filter(d => d !== day);
                                    updateItem(index, 'specificDays', days);
                                  }}
                                />
                                <span className="text-sm">{day}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t">
                <Button onClick={saveTemplate} className="bg-green-600 hover:bg-green-700">
                  💾 Save Checklist
                </Button>
                <Button onClick={cancelEditing} variant="outline">
                  ❌ Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}