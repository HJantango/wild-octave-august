'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  BookOpenIcon,
  PlusIcon,
  CheckCircleIcon,
  CircleIcon,
  TrashIcon,
  EditIcon,
  XCircleIcon,
  CalendarIcon
} from 'lucide-react';

interface DiaryEntry {
  id: string;
  title: string;
  description?: string;
  urgency: string;
  assignedTo?: string;
  dueDate?: string;
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

const URGENCY_COLORS = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const URGENCY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export default function ShopDiaryPage() {
  const toast = useToast();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/shop-diary?showCompleted=${showCompleted}`);
      const result = await response.json();

      if (result.success) {
        setEntries(result.data || []);
      } else {
        toast.error('Load Failed', 'Failed to load diary entries');
      }
    } catch (error) {
      console.error('Error loading entries:', error);
      toast.error('Error', 'Failed to load diary entries');
    } finally {
      setLoading(false);
    }
  }, [showCompleted, toast]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const openModal = (entry?: DiaryEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setTitle(entry.title);
      setDescription(entry.description || '');
      setUrgency(entry.urgency);
      setAssignedTo(entry.assignedTo || '');
      setDueDate(entry.dueDate ? entry.dueDate.split('T')[0] : '');
    } else {
      setEditingEntry(null);
      setTitle('');
      setDescription('');
      setUrgency('medium');
      setAssignedTo('');
      setDueDate('');
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEntry(null);
    setTitle('');
    setDescription('');
    setUrgency('medium');
    setAssignedTo('');
    setDueDate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      title,
      description,
      urgency,
      assignedTo,
      dueDate: dueDate || null,
      createdBy: 'Current User',
    };

    try {
      const url = editingEntry
        ? `/api/shop-diary/${editingEntry.id}`
        : '/api/shop-diary';

      const method = editingEntry ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          editingEntry ? 'Entry Updated' : 'Entry Created',
          result.message || 'Operation successful'
        );
        closeModal();
        loadEntries();
      } else {
        toast.error('Error', result.error?.message || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      toast.error('Error', 'Failed to save entry');
    }
  };

  const toggleComplete = async (entry: DiaryEntry) => {
    try {
      const response = await fetch(`/api/shop-diary/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isCompleted: !entry.isCompleted,
          completedBy: !entry.isCompleted ? 'Current User' : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Updated', 'Entry status updated');
        loadEntries();
      } else {
        toast.error('Error', 'Failed to update status');
      }
    } catch (error) {
      console.error('Error toggling completion:', error);
      toast.error('Error', 'Failed to update status');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      const response = await fetch(`/api/shop-diary/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Deleted', 'Entry deleted successfully');
        loadEntries();
      } else {
        toast.error('Error', 'Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Error', 'Failed to delete entry');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Shop Diary</h1>
                <p className="text-purple-100 text-lg">
                  Staff tasks, messages, and action items
                </p>
                <p className="text-purple-200 text-sm mt-1">
                  {entries.filter(e => !e.isCompleted).length} active • {entries.filter(e => e.isCompleted).length} completed
                </p>
              </div>
              <div className="mt-4 lg:mt-0 flex items-center space-x-3">
                <Button
                  onClick={() => setShowCompleted(!showCompleted)}
                  variant={showCompleted ? 'secondary' : 'outline'}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                >
                  {showCompleted ? 'Hide' : 'Show'} Completed
                </Button>
                <Button
                  onClick={() => openModal()}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm px-6 py-3 text-lg font-semibold"
                >
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Add Entry
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Entries List */}
        <Card>
          <CardHeader>
            <CardTitle>Diary Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="text-center py-12">
                <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No entries found</h3>
                <p className="text-gray-600 mb-4">
                  {showCompleted ? 'No completed entries' : 'Get started by adding your first entry'}
                </p>
                <Button onClick={() => openModal()}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Entry
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`border rounded-lg p-4 ${
                      entry.isCompleted ? 'bg-gray-50 opacity-60' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <button
                          onClick={() => toggleComplete(entry)}
                          className="mt-1 text-gray-400 hover:text-blue-600"
                        >
                          {entry.isCompleted ? (
                            <CheckCircleIcon className="w-6 h-6 text-green-600" />
                          ) : (
                            <CircleIcon className="w-6 h-6" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className={`font-semibold ${entry.isCompleted ? 'line-through' : ''}`}>
                              {entry.title}
                            </h3>
                            <Badge className={URGENCY_COLORS[entry.urgency as keyof typeof URGENCY_COLORS]}>
                              {URGENCY_LABELS[entry.urgency as keyof typeof URGENCY_LABELS]}
                            </Badge>
                            {entry.dueDate && (
                              <Badge className={isOverdue(entry.dueDate) && !entry.isCompleted ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                                <CalendarIcon className="w-3 h-3 mr-1" />
                                {formatDate(entry.dueDate)}
                              </Badge>
                            )}
                          </div>

                          {entry.description && (
                            <p className="text-sm text-gray-600 mb-2">{entry.description}</p>
                          )}

                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            {entry.assignedTo && (
                              <span>Assigned: <strong>{entry.assignedTo}</strong></span>
                            )}
                            {entry.completedBy && (
                              <span>Completed by: <strong>{entry.completedBy}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openModal(entry)}
                          disabled={entry.isCompleted}
                        >
                          <EditIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteEntry(entry.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={closeModal}></div>
            <div className="relative bg-white rounded-lg max-w-2xl w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium">
                  {editingEntry ? 'Edit Entry' : 'New Entry'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Enter task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Add details about this task..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Urgency
                    </label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned To
                  </label>
                  <Input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="Staff member name"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                  >
                    {editingEntry ? 'Update' : 'Create'} Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
