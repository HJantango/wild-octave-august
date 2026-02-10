'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  DownloadIcon,
  SnowflakeIcon,
  BoxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  PrinterIcon,
  PencilIcon,
  SettingsIcon,
  PlusIcon,
  TrashIcon,
  RefreshCwIcon,
  UsersIcon,
  ListIcon,
} from 'lucide-react';

interface ShopOpsTask {
  id: string;
  name: string;
  description: string | null;
  category: string;
  asset: string | null;
  frequencyType: string;
  frequencyValue: number;
  estimatedMinutes: number | null;
  assignedTo: string[];
  isActive?: boolean;
}

interface ShopOpsStaff {
  id: string;
  name: string;
  email: string | null;
  role: string;
  isActive: boolean;
}

interface ShopOpsSchedule {
  id: string;
  taskId: string;
  dueDate: string;
  assignedTo: string | null;
  status: string;
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
  task: ShopOpsTask;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  fridge: BoxIcon,
  freezer: SnowflakeIcon,
};

const CATEGORY_COLORS: Record<string, string> = {
  fridge: 'bg-blue-100 text-blue-800 border-blue-300',
  freezer: 'bg-purple-100 text-purple-800 border-purple-300',
  pest: 'bg-orange-100 text-orange-800 border-orange-300',
  safety: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-800',
};

export default function ShopOpsPage() {
  const toast = useToast();
  const [schedules, setSchedules] = useState<ShopOpsSchedule[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<ShopOpsSchedule[]>([]);
  const [weekSchedules, setWeekSchedules] = useState<ShopOpsSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<ShopOpsSchedule | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [completedBy, setCompletedBy] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Management state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'tasks' | 'staff' | 'generate'>('tasks');
  const [tasks, setTasks] = useState<ShopOpsTask[]>([]);
  const [staff, setStaff] = useState<ShopOpsStaff[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ShopOpsTask | null>(null);
  const [taskForm, setTaskForm] = useState({
    name: '',
    category: 'fridge',
    frequencyType: 'monthly',
    frequencyValue: 1,
    estimatedMinutes: 30,
    assignedTo: '',
  });

  // Staff form
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<ShopOpsStaff | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    role: 'staff',
  });

  // Generate schedule form
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth());
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      
      // Load month schedules
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const response = await fetch(
        `/api/shop-ops?startDate=${firstDay.toISOString()}&endDate=${lastDay.toISOString()}`
      );
      const result = await response.json();

      // Load today and this week
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      
      const weekResponse = await fetch(
        `/api/shop-ops?startDate=${today.toISOString()}&endDate=${weekEnd.toISOString()}`
      );
      const weekResult = await weekResponse.json();

      if (result.success) {
        // Mark overdue items
        const schedulesWithStatus = result.data.map((s: ShopOpsSchedule) => {
          if (s.status === 'pending' && new Date(s.dueDate) < now) {
            return { ...s, status: 'overdue' };
          }
          return s;
        });
        setSchedules(schedulesWithStatus);
      }

      if (weekResult.success) {
        const todayStr = today.toISOString().split('T')[0];
        
        // Filter today's tasks
        const todayTasks = weekResult.data.filter((s: ShopOpsSchedule) => {
          const scheduleDate = new Date(s.dueDate).toISOString().split('T')[0];
          return scheduleDate === todayStr && s.status !== 'completed';
        });
        setTodaySchedules(todayTasks);
        
        // All week tasks (excluding completed)
        const weekTasks = weekResult.data.filter((s: ShopOpsSchedule) => s.status !== 'completed');
        setWeekSchedules(weekTasks);
      }

      if (!result.success) {
        toast.error('Load Failed', 'Failed to load schedules');
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast.error('Error', 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, [currentMonth, toast]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleComplete = async () => {
    if (!selectedSchedule || !completedBy) {
      toast.error('Missing Info', 'Please enter who completed this task');
      return;
    }

    try {
      const response = await fetch(`/api/shop-ops/schedule/${selectedSchedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          completedBy,
          notes: completionNotes,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Task Complete! ✅', `${selectedSchedule.task.name} marked as done`);
        setShowCompleteModal(false);
        setSelectedSchedule(null);
        setCompletedBy('');
        setCompletionNotes('');
        loadSchedules();
      } else {
        toast.error('Error', result.error?.message || 'Failed to mark complete');
      }
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Error', 'Failed to mark task as complete');
    }
  };

  const openCompleteModal = (schedule: ShopOpsSchedule) => {
    setSelectedSchedule(schedule);
    setCompletedBy(schedule.assignedTo || '');
    setShowCompleteModal(true);
  };

  const openEditModal = (schedule: ShopOpsSchedule) => {
    setSelectedSchedule(schedule);
    setEditAssignedTo(schedule.assignedTo || '');
    setEditDueDate(schedule.dueDate.split('T')[0]);
    setEditNotes(schedule.notes || '');
    setShowEditModal(true);
  };

  // Load tasks and staff for management
  const loadManagementData = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const [tasksRes, staffRes] = await Promise.all([
        fetch('/api/shop-ops?view=tasks'),
        fetch('/api/shop-ops/staff'),
      ]);
      const tasksData = await tasksRes.json();
      const staffData = await staffRes.json();

      if (tasksData.success) setTasks(tasksData.data);
      if (staffData.success) setStaff(staffData.data);
    } catch (error) {
      console.error('Error loading management data:', error);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  // Open settings panel
  const openSettings = () => {
    setShowSettings(true);
    loadManagementData();
  };

  // Task CRUD
  const handleSaveTask = async () => {
    try {
      const url = editingTask 
        ? `/api/shop-ops/tasks/${editingTask.id}`
        : '/api/shop-ops';
      
      const method = editingTask ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...taskForm,
          assignedTo: taskForm.assignedTo ? [taskForm.assignedTo] : [],
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(editingTask ? 'Task Updated! ✅' : 'Task Created! ✅', result.message);
        setShowTaskForm(false);
        setEditingTask(null);
        resetTaskForm();
        loadManagementData();
        loadSchedules();
      } else {
        toast.error('Error', result.error?.message || 'Failed to save task');
      }
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Error', 'Failed to save task');
    }
  };

  const handleDeleteTask = async (task: ShopOpsTask) => {
    if (!confirm(`Delete "${task.name}"? This will cancel all pending schedules for this task.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/shop-ops/tasks/${task.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Task Deleted', task.name);
        loadManagementData();
        loadSchedules();
      } else {
        toast.error('Error', result.error?.message || 'Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Error', 'Failed to delete task');
    }
  };

  const openEditTask = (task: ShopOpsTask) => {
    setEditingTask(task);
    setTaskForm({
      name: task.name,
      category: task.category,
      frequencyType: task.frequencyType,
      frequencyValue: task.frequencyValue,
      estimatedMinutes: task.estimatedMinutes || 30,
      assignedTo: task.assignedTo?.[0] || '',
    });
    setShowTaskForm(true);
  };

  const resetTaskForm = () => {
    setTaskForm({
      name: '',
      category: 'fridge',
      frequencyType: 'monthly',
      frequencyValue: 1,
      estimatedMinutes: 30,
      assignedTo: '',
    });
  };

  // Staff CRUD
  const handleSaveStaff = async () => {
    try {
      const url = editingStaff 
        ? `/api/shop-ops/staff/${editingStaff.id}`
        : '/api/shop-ops/staff';
      
      const method = editingStaff ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(editingStaff ? 'Staff Updated! ✅' : 'Staff Added! ✅', result.message);
        setShowStaffForm(false);
        setEditingStaff(null);
        resetStaffForm();
        loadManagementData();
      } else {
        toast.error('Error', result.error?.message || 'Failed to save');
      }
    } catch (error) {
      console.error('Error saving staff:', error);
      toast.error('Error', 'Failed to save staff');
    }
  };

  const handleDeleteStaff = async (member: ShopOpsStaff) => {
    if (!confirm(`Remove "${member.name}" from staff?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/shop-ops/staff/${member.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Staff Removed', member.name);
        loadManagementData();
      } else {
        toast.error('Error', result.error?.message || 'Failed to remove');
      }
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast.error('Error', 'Failed to remove staff');
    }
  };

  const openEditStaff = (member: ShopOpsStaff) => {
    setEditingStaff(member);
    setStaffForm({
      name: member.name,
      email: member.email || '',
      role: member.role,
    });
    setShowStaffForm(true);
  };

  const resetStaffForm = () => {
    setStaffForm({
      name: '',
      email: '',
      role: 'staff',
    });
  };

  // Generate schedules
  const handleGenerateSchedules = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/shop-ops/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: generateMonth,
          year: generateYear,
          overwrite: false,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Schedules Generated! 📅', result.message);
        loadSchedules();
      } else {
        toast.error('Error', result.error?.message || 'Failed to generate');
      }
    } catch (error) {
      console.error('Error generating schedules:', error);
      toast.error('Error', 'Failed to generate schedules');
    } finally {
      setGenerating(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedSchedule) return;

    try {
      const response = await fetch(`/api/shop-ops/schedule/${selectedSchedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTo: editAssignedTo,
          dueDate: editDueDate,
          notes: editNotes,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Updated! ✅', 'Schedule updated successfully');
        setShowEditModal(false);
        setSelectedSchedule(null);
        loadSchedules();
      } else {
        toast.error('Error', result.error?.message || 'Failed to update');
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error('Error', 'Failed to update schedule');
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const downloadCalendar = (assignedTo?: string) => {
    const url = assignedTo 
      ? `/api/shop-ops/export?format=ical&assignedTo=${encodeURIComponent(assignedTo)}`
      : '/api/shop-ops/export?format=ical';
    window.open(url, '_blank');
    toast.success('Calendar Export', 'Download started! Import this file into Google Calendar.');
  };

  // Group schedules by week
  const groupedByWeek = schedules.reduce((acc, schedule) => {
    const date = new Date(schedule.dueDate);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!acc[weekKey]) {
      acc[weekKey] = [];
    }
    acc[weekKey].push(schedule);
    return acc;
  }, {} as Record<string, ShopOpsSchedule[]>);

  const pendingCount = schedules.filter(s => s.status === 'pending' || s.status === 'overdue').length;
  const completedCount = schedules.filter(s => s.status === 'completed').length;
  const overdueCount = schedules.filter(s => s.status === 'overdue').length;

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
        <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">🧊 Shop Ops</h1>
                <p className="text-blue-100 text-lg">
                  Fridge & Freezer Maintenance Calendar
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="bg-white/20 px-2 py-1 rounded">
                    {pendingCount} pending
                  </span>
                  <span className="bg-green-500/40 px-2 py-1 rounded">
                    {completedCount} done
                  </span>
                  {overdueCount > 0 && (
                    <span className="bg-red-500/40 px-2 py-1 rounded">
                      {overdueCount} overdue
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 lg:mt-0 flex flex-wrap gap-2">
                <Button
                  onClick={() => downloadCalendar()}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                >
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Export Calendar
                </Button>
                <Button
                  onClick={() => window.print()}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                >
                  <PrinterIcon className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button
                  onClick={openSettings}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                >
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* TODAY Section */}
        <Card className="border-2 border-blue-500 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <CalendarIcon className="w-6 h-6" />
              📍 Today — {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaySchedules.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <CheckCircle2Icon className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p className="text-lg font-medium text-green-700">All clear for today! ✨</p>
                <p className="text-sm">No maintenance tasks due today.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySchedules.map((schedule) => {
                  const CategoryIcon = CATEGORY_ICONS[schedule.task.category] || BoxIcon;
                  return (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${CATEGORY_COLORS[schedule.task.category] || 'bg-gray-100'}`}>
                          <CategoryIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{schedule.task.name}</h4>
                          <p className="text-sm text-gray-500">
                            {schedule.assignedTo && `Assigned to ${schedule.assignedTo}`}
                            {schedule.task.estimatedMinutes && ` • ~${schedule.task.estimatedMinutes} min`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => openEditModal(schedule)}
                          className="px-3"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => openCompleteModal(schedule)}
                          className="bg-green-600 hover:bg-green-700 text-white px-6"
                        >
                          <CheckCircle2Icon className="w-5 h-5 mr-2" />
                          Mark Done
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* THIS WEEK Section */}
        <Card className="border-2 border-purple-400">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <ClockIcon className="w-6 h-6" />
              📅 This Week — {weekSchedules.length} task{weekSchedules.length !== 1 ? 's' : ''} remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weekSchedules.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <p>No tasks scheduled for this week.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {weekSchedules.map((schedule) => {
                  const CategoryIcon = CATEGORY_ICONS[schedule.task.category] || BoxIcon;
                  const scheduleDate = new Date(schedule.dueDate);
                  const isToday = scheduleDate.toDateString() === new Date().toDateString();
                  
                  return (
                    <div
                      key={schedule.id}
                      className={`p-4 rounded-lg border ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${CATEGORY_COLORS[schedule.task.category] || 'bg-gray-100'}`}>
                          <CategoryIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{schedule.task.name}</p>
                          <p className={`text-sm ${isToday ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>
                            {isToday ? '📍 Today' : scheduleDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(schedule)}
                            className="px-2"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openCompleteModal(schedule)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Done
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigateMonth(-1)}>
            <ChevronLeftIcon className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <h2 className="text-xl font-bold">
            {currentMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
          </h2>
          <Button variant="outline" onClick={() => navigateMonth(1)}>
            Next
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BoxIcon className="w-8 h-8 opacity-80" />
                <div>
                  <p className="text-sm opacity-90">Fridges</p>
                  <p className="text-2xl font-bold">7</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <SnowflakeIcon className="w-8 h-8 opacity-80" />
                <div>
                  <p className="text-sm opacity-90">Freezers</p>
                  <p className="text-2xl font-bold">2</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2Icon className="w-8 h-8 opacity-80" />
                <div>
                  <p className="text-sm opacity-90">Completed</p>
                  <p className="text-2xl font-bold">{completedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <ClockIcon className="w-8 h-8 opacity-80" />
                <div>
                  <p className="text-sm opacity-90">Pending</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schedule List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              This Month&apos;s Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <BoxIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No maintenance tasks scheduled for this month.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByWeek).sort().map(([weekKey, weekSchedules]) => {
                  const weekStart = new Date(weekKey);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekEnd.getDate() + 6);
                  
                  return (
                    <div key={weekKey} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b">
                        <h3 className="font-semibold text-sm text-gray-600">
                          Week of {weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - {weekEnd.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </h3>
                      </div>
                      <div className="divide-y">
                        {weekSchedules.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((schedule) => {
                          const CategoryIcon = CATEGORY_ICONS[schedule.task.category] || BoxIcon;
                          const isOverdue = schedule.status === 'overdue';
                          const isCompleted = schedule.status === 'completed';
                          
                          return (
                            <div
                              key={schedule.id}
                              className={`p-4 flex items-center justify-between hover:bg-gray-50 ${
                                isCompleted ? 'opacity-60' : ''
                              } ${isOverdue ? 'bg-red-50' : ''}`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${CATEGORY_COLORS[schedule.task.category] || 'bg-gray-100'}`}>
                                  <CategoryIcon className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className={`font-medium ${isCompleted ? 'line-through' : ''}`}>
                                    {schedule.task.name}
                                  </h4>
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span>{formatDate(schedule.dueDate)}</span>
                                    {schedule.assignedTo && (
                                      <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                          <UserIcon className="w-3 h-3" />
                                          {schedule.assignedTo}
                                        </span>
                                      </>
                                    )}
                                    {schedule.task.estimatedMinutes && (
                                      <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                          <ClockIcon className="w-3 h-3" />
                                          ~{schedule.task.estimatedMinutes}min
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={STATUS_COLORS[schedule.status]}>
                                  {schedule.status}
                                </Badge>
                                {!isCompleted && (
                                  <Button
                                    size="sm"
                                    onClick={() => openCompleteModal(schedule)}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <CheckCircle2Icon className="w-4 h-4 mr-1" />
                                    Done
                                  </Button>
                                )}
                                {isCompleted && schedule.completedBy && (
                                  <span className="text-sm text-gray-500">
                                    by {schedule.completedBy}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Print Section */}
        <Card className="print:block hidden">
          <CardHeader>
            <CardTitle>Wild Octave - Fridge Maintenance Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Task</th>
                  <th className="text-left p-2">Assigned To</th>
                  <th className="text-left p-2">Completed</th>
                  <th className="text-left p-2">Signature</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b">
                    <td className="p-2">{formatDate(schedule.dueDate)}</td>
                    <td className="p-2">{schedule.task.name}</td>
                    <td className="p-2">{schedule.assignedTo || '-'}</td>
                    <td className="p-2">{schedule.status === 'completed' ? '✓' : '☐'}</td>
                    <td className="p-2 w-32"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Complete Modal */}
      {showCompleteModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCompleteModal(false)}></div>
            <div className="relative bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-bold mb-4">
                ✅ Mark as Complete
              </h3>
              <p className="text-gray-600 mb-4">
                {selectedSchedule.task.name}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Completed By *
                  </label>
                  <select
                    value={completedBy}
                    onChange={(e) => setCompletedBy(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select staff member</option>
                    <option value="Jasper">Jasper</option>
                    <option value="Heath">Heath</option>
                    <option value="Jackie">Jackie</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    rows={3}
                    placeholder="Any issues or notes..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleComplete}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2Icon className="w-4 h-4 mr-2" />
                  Confirm Complete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowEditModal(false)}></div>
            <div className="relative bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-bold mb-4">
                ✏️ Edit Task
              </h3>
              <p className="text-gray-600 mb-4">
                {selectedSchedule.task.name}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned To
                  </label>
                  <select
                    value={editAssignedTo}
                    onChange={(e) => setEditAssignedTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Unassigned</option>
                    <option value="Jasper">Jasper</option>
                    <option value="Heath">Heath</option>
                    <option value="Jackie">Jackie</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    placeholder="Any notes about this task..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <PencilIcon className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowSettings(false)}></div>
            <div className="relative bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-6 border-b">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <SettingsIcon className="w-6 h-6" />
                  Shop Ops Settings
                </h3>
                <p className="text-gray-500 mt-1">Manage fridges, freezers, staff, and schedules</p>
              </div>

              {/* Tabs */}
              <div className="flex border-b px-6">
                <button
                  onClick={() => setSettingsTab('tasks')}
                  className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                    settingsTab === 'tasks'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ListIcon className="w-4 h-4 inline mr-2" />
                  Fridges & Freezers
                </button>
                <button
                  onClick={() => setSettingsTab('staff')}
                  className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                    settingsTab === 'staff'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <UsersIcon className="w-4 h-4 inline mr-2" />
                  Staff
                </button>
                <button
                  onClick={() => setSettingsTab('generate')}
                  className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                    settingsTab === 'generate'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <RefreshCwIcon className="w-4 h-4 inline mr-2" />
                  Generate Schedule
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingSettings ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <>
                    {/* Tasks Tab */}
                    {settingsTab === 'tasks' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-lg">Fridges & Freezers</h4>
                          <Button
                            onClick={() => {
                              resetTaskForm();
                              setEditingTask(null);
                              setShowTaskForm(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <PlusIcon className="w-4 h-4 mr-2" />
                            Add New
                          </Button>
                        </div>

                        {showTaskForm && (
                          <Card className="border-2 border-blue-300 bg-blue-50">
                            <CardContent className="p-4">
                              <h5 className="font-medium mb-4">
                                {editingTask ? 'Edit Task' : 'Add New Task'}
                              </h5>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                  <label className="block text-sm font-medium mb-1">Name *</label>
                                  <input
                                    type="text"
                                    value={taskForm.name}
                                    onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                                    placeholder="e.g., Dairy Fridge"
                                    className="w-full border rounded-md px-3 py-2"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Type</label>
                                  <select
                                    value={taskForm.category}
                                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2"
                                  >
                                    <option value="fridge">Fridge</option>
                                    <option value="freezer">Freezer</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Frequency</label>
                                  <select
                                    value={taskForm.frequencyType}
                                    onChange={(e) => setTaskForm({ ...taskForm, frequencyType: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2"
                                  >
                                    <option value="weekly">Weekly</option>
                                    <option value="biweekly">Bi-weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="bimonthly">Bi-monthly</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Est. Minutes</label>
                                  <input
                                    type="number"
                                    value={taskForm.estimatedMinutes}
                                    onChange={(e) => setTaskForm({ ...taskForm, estimatedMinutes: parseInt(e.target.value) || 30 })}
                                    className="w-full border rounded-md px-3 py-2"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Default Assignee</label>
                                  <select
                                    value={taskForm.assignedTo}
                                    onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2"
                                  >
                                    <option value="">Unassigned</option>
                                    {staff.map((s) => (
                                      <option key={s.id} value={s.name}>{s.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-4">
                                <Button variant="outline" onClick={() => setShowTaskForm(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveTask} className="bg-blue-600 hover:bg-blue-700 text-white">
                                  {editingTask ? 'Update' : 'Add'} Task
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        <div className="space-y-2">
                          {tasks.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No tasks yet. Add your first fridge or freezer!</p>
                          ) : (
                            tasks.map((task) => {
                              const CategoryIcon = CATEGORY_ICONS[task.category] || BoxIcon;
                              return (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-sm"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${CATEGORY_COLORS[task.category] || 'bg-gray-100'}`}>
                                      <CategoryIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <p className="font-medium">{task.name}</p>
                                      <p className="text-sm text-gray-500">
                                        {task.frequencyType} • {task.estimatedMinutes || '?'}min
                                        {task.assignedTo?.[0] && ` • ${task.assignedTo[0]}`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => openEditTask(task)}>
                                      <PencilIcon className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleDeleteTask(task)} className="text-red-600 hover:bg-red-50">
                                      <TrashIcon className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* Staff Tab */}
                    {settingsTab === 'staff' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-lg">Staff Members</h4>
                          <Button
                            onClick={() => {
                              resetStaffForm();
                              setEditingStaff(null);
                              setShowStaffForm(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <PlusIcon className="w-4 h-4 mr-2" />
                            Add Staff
                          </Button>
                        </div>

                        {showStaffForm && (
                          <Card className="border-2 border-blue-300 bg-blue-50">
                            <CardContent className="p-4">
                              <h5 className="font-medium mb-4">
                                {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
                              </h5>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-1">Name *</label>
                                  <input
                                    type="text"
                                    value={staffForm.name}
                                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                                    placeholder="e.g., Jasper"
                                    className="w-full border rounded-md px-3 py-2"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Role</label>
                                  <select
                                    value={staffForm.role}
                                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2"
                                  >
                                    <option value="staff">Staff</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-sm font-medium mb-1">Email (optional)</label>
                                  <input
                                    type="email"
                                    value={staffForm.email}
                                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                                    placeholder="email@example.com"
                                    className="w-full border rounded-md px-3 py-2"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-4">
                                <Button variant="outline" onClick={() => setShowStaffForm(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveStaff} className="bg-blue-600 hover:bg-blue-700 text-white">
                                  {editingStaff ? 'Update' : 'Add'} Staff
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        <div className="space-y-2">
                          {staff.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No staff members yet.</p>
                          ) : (
                            staff.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-sm"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-full bg-gray-100">
                                    <UserIcon className="w-5 h-5 text-gray-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{member.name}</p>
                                    <p className="text-sm text-gray-500">
                                      {member.role}
                                      {member.email && ` • ${member.email}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openEditStaff(member)}>
                                    <PencilIcon className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleDeleteStaff(member)} className="text-red-600 hover:bg-red-50">
                                    <TrashIcon className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Generate Tab */}
                    {settingsTab === 'generate' && (
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-semibold text-lg mb-2">Generate Monthly Schedules</h4>
                          <p className="text-gray-500 text-sm">
                            Automatically create cleaning schedules for a month. Fridges will be spread across the month (~2 per week), 
                            and freezers on a bi-monthly schedule.
                          </p>
                        </div>

                        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
                          <CardContent className="p-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-1">Month</label>
                                <select
                                  value={generateMonth}
                                  onChange={(e) => setGenerateMonth(parseInt(e.target.value))}
                                  className="w-full border rounded-md px-3 py-2"
                                >
                                  {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i} value={i}>
                                      {new Date(2024, i).toLocaleDateString('en-AU', { month: 'long' })}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Year</label>
                                <select
                                  value={generateYear}
                                  onChange={(e) => setGenerateYear(parseInt(e.target.value))}
                                  className="w-full border rounded-md px-3 py-2"
                                >
                                  {Array.from({ length: 3 }, (_, i) => (
                                    <option key={i} value={new Date().getFullYear() + i}>
                                      {new Date().getFullYear() + i}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="mt-6">
                              <Button
                                onClick={handleGenerateSchedules}
                                disabled={generating}
                                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-3"
                              >
                                {generating ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCwIcon className="w-5 h-5 mr-2" />
                                    Generate Schedule for {new Date(generateYear, generateMonth).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <p className="text-sm text-yellow-800">
                            <strong>💡 Tip:</strong> After generating, you can use the Edit button (✏️) on any task in the calendar 
                            to change the date or reassign to a different staff member.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t bg-gray-50">
                <Button variant="outline" onClick={() => setShowSettings(false)} className="w-full">
                  Close Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
