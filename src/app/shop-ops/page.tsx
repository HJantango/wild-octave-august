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
  const [completedBy, setCompletedBy] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

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
                      <Button
                        onClick={() => openCompleteModal(schedule)}
                        className="bg-green-600 hover:bg-green-700 text-white px-6"
                      >
                        <CheckCircle2Icon className="w-5 h-5 mr-2" />
                        Mark Done
                      </Button>
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
                        <Button
                          size="sm"
                          onClick={() => openCompleteModal(schedule)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Done
                        </Button>
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
    </DashboardLayout>
  );
}
