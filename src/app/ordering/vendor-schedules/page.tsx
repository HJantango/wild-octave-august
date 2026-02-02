'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Edit, Trash2, RefreshCw, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
}

interface VendorSchedule {
  id: string;
  vendorId: string;
  vendor: {
    id: string;
    name: string;
  };
  orderDay: string;
  deliveryDay: string | null;
  frequency: string;
  weekOffset: number;
  leadTimeDays: number;
  isActive: boolean;
  orderDeadline: string | null;
  assignees: string[];
  orderType: string;
  contactMethod: string | null;
  trigger: string | null;
  notes: string | null;
}

interface ScheduleFormData {
  vendorId: string;
  orderDay: string;
  deliveryDay: string;
  frequency: string;
  weekOffset: number;
  leadTimeDays: number;
  isActive: boolean;
  orderDeadline: string;
  assignees: string[];
  orderType: string;
  contactMethod: string;
  trigger: string;
  notes: string;
}

// Staff members who can be assigned to orders
const STAFF_MEMBERS = [
  'Heath',
  'Jackie',
  'Charlotte',
  'Tosh',
  'Nathan',
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_INDEX_MAP: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6,
};

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'six-weekly', label: 'Every 6 Weeks' },
  { value: 'bi-monthly', label: 'Bi-monthly' },
  { value: 'when-needed', label: 'When Needed' },
];

const ORDER_TYPES = [
  { value: 'regular', label: 'Regular Schedule' },
  { value: 'when-needed', label: 'When Needed (Incidental)' },
];

const CONTACT_METHODS = [
  { value: '', label: 'Not specified' },
  { value: 'Call', label: 'Phone Call' },
  { value: 'Text', label: 'Text/SMS' },
  { value: 'Email', label: 'Email' },
  { value: 'Online', label: 'Online Order' },
  { value: 'They call us', label: 'They call us' },
];

const DEADLINE_TIMES = [
  { value: '', label: 'No deadline' },
  { value: '7:00 AM', label: '7:00 AM' },
  { value: '8:00 AM', label: '8:00 AM' },
  { value: '9:00 AM', label: '9:00 AM' },
  { value: '10:00 AM', label: '10:00 AM' },
  { value: '11:00 AM', label: '11:00 AM' },
  { value: '12:00 PM', label: '12:00 PM' },
  { value: '1:00 PM', label: '1:00 PM' },
  { value: '2:00 PM', label: '2:00 PM' },
  { value: '3:00 PM', label: '3:00 PM' },
  { value: '4:00 PM', label: '4:00 PM' },
  { value: '5:00 PM', label: '5:00 PM' },
];

function getNextOrderDate(schedule: VendorSchedule): Date | null {
  const targetDayIndex = DAY_INDEX_MAP[schedule.orderDay];
  if (targetDayIndex === undefined) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDay = today.getDay();

  let daysUntil = targetDayIndex - currentDay;
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0) {
    // It's the order day — check if deadline has passed
    if (schedule.orderDeadline) {
      const now = new Date();
      const deadlineHour = parseDeadlineHour(schedule.orderDeadline);
      if (deadlineHour !== null && now.getHours() >= deadlineHour) {
        daysUntil = 7; // Move to next week for weekly
      }
    }
    // For non-weekly, we still show today
    if (daysUntil === 0) {
      return today;
    }
  }

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);

  // For weekly, just return the next occurrence
  if (schedule.frequency === 'weekly') return nextDate;

  // For other frequencies, this is an approximation
  return nextDate;
}

function parseDeadlineHour(deadline: string): number | null {
  const match = deadline.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = parseInt(match[1]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour;
}

function isDueToday(schedule: VendorSchedule): boolean {
  const today = new Date();
  const todayDay = DAYS_OF_WEEK[(today.getDay() + 6) % 7]; // Convert Sunday=0 to Monday-first
  // Actually use the proper day names
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return schedule.orderDay === dayNames[today.getDay()];
}

function isOverdue(schedule: VendorSchedule): boolean {
  if (!isDueToday(schedule) || !schedule.orderDeadline) return false;
  const now = new Date();
  const deadlineHour = parseDeadlineHour(schedule.orderDeadline);
  if (deadlineHour === null) return false;
  return now.getHours() >= deadlineHour;
}

export default function VendorSchedulesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<VendorSchedule | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>({
    vendorId: '',
    orderDay: 'Monday',
    deliveryDay: '',
    frequency: 'weekly',
    weekOffset: 0,
    leadTimeDays: 1,
    isActive: true,
    orderDeadline: '',
    notes: '',
  });

  // Fetch vendors
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const res = await fetch('/api/vendors?limit=100');
      if (!res.ok) throw new Error('Failed to fetch vendors');
      return res.json() as Promise<Vendor[]>;
    },
  });

  // Fetch schedules
  const { data: schedulesData, isLoading } = useQuery({
    queryKey: ['vendorSchedules'],
    queryFn: async () => {
      const res = await fetch('/api/vendor-schedules');
      if (!res.ok) throw new Error('Failed to fetch schedules');
      const result = await res.json();
      return result.data?.schedules || result.data || [];
    },
  });

  // Sort schedules: due today first, then overdue, then by next order date
  const sortedSchedules = useMemo(() => {
    if (!schedulesData) return [];
    return [...schedulesData].sort((a: VendorSchedule, b: VendorSchedule) => {
      const aDue = isDueToday(a);
      const bDue = isDueToday(b);
      const aOverdue = isOverdue(a);
      const bOverdue = isOverdue(b);
      
      // Overdue first
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      // Then due today
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      // Then alphabetically by vendor name
      return a.vendor.name.localeCompare(b.vendor.name);
    });
  }, [schedulesData]);

  // Create schedule mutation
  const createSchedule = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      const res = await fetch('/api/vendor-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to create schedule');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorSchedules'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  // Update schedule mutation
  const updateSchedule = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ScheduleFormData> }) => {
      const res = await fetch(`/api/vendor-schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to update schedule');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorSchedules'] });
      setIsDialogOpen(false);
      setEditingSchedule(null);
      resetForm();
    },
  });

  // Delete schedule mutation
  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vendor-schedules/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete schedule');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorSchedules'] });
    },
  });

  const resetForm = () => {
    setFormData({
      vendorId: '',
      orderDay: 'Monday',
      deliveryDay: '',
      frequency: 'weekly',
      weekOffset: 0,
      leadTimeDays: 1,
      isActive: true,
      orderDeadline: '',
      assignees: [],
      orderType: 'regular',
      contactMethod: '',
      trigger: '',
      notes: '',
    });
  };

  const handleOpenDialog = (schedule?: VendorSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        vendorId: schedule.vendorId,
        orderDay: schedule.orderDay,
        deliveryDay: schedule.deliveryDay || '',
        frequency: schedule.frequency,
        weekOffset: schedule.weekOffset,
        leadTimeDays: schedule.leadTimeDays,
        isActive: schedule.isActive,
        orderDeadline: schedule.orderDeadline || '',
        assignees: schedule.assignees || [],
        orderType: schedule.orderType || 'regular',
        contactMethod: schedule.contactMethod || '',
        trigger: schedule.trigger || '',
        notes: schedule.notes || '',
      });
    } else {
      setEditingSchedule(null);
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSchedule) {
      updateSchedule.mutate({ id: editingSchedule.id, data: formData });
    } else {
      createSchedule.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      deleteSchedule.mutate(id);
    }
  };

  const getFrequencyLabel = (frequency: string, weekOffset: number) => {
    const freq = FREQUENCIES.find(f => f.value === frequency);
    if (frequency === 'bi-weekly' || frequency === 'fortnightly' || frequency === 'monthly' || frequency === 'six-weekly') {
      return `${freq?.label || frequency} (Week ${weekOffset + 1})`;
    }
    return freq?.label || frequency;
  };

  const getDueTodayCount = () => {
    if (!schedulesData) return 0;
    return schedulesData.filter((s: VendorSchedule) => isDueToday(s) && s.isActive).length;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Vendor Order Schedules</h1>
              <p className="text-gray-600">Set up recurring order schedules for your vendors</p>
            </div>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Schedule
          </Button>
        </div>

        {/* Due Today Banner */}
        {getDueTodayCount() > 0 && (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-semibold text-yellow-800">
                    {getDueTodayCount()} order{getDueTodayCount() !== 1 ? 's' : ''} due today
                  </p>
                  <p className="text-sm text-yellow-700">
                    {schedulesData
                      ?.filter((s: VendorSchedule) => isDueToday(s) && s.isActive)
                      .map((s: VendorSchedule) => `${s.vendor.name}${s.orderDeadline ? ` by ${s.orderDeadline}` : ''}`)
                      .join(' • ')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedules List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isLoading ? (
            <div className="col-span-2 flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-purple-600" />
                <p className="text-gray-600">Loading schedules...</p>
              </div>
            </div>
          ) : sortedSchedules && sortedSchedules.length > 0 ? (
            sortedSchedules.map((schedule: VendorSchedule) => {
              const dueToday = isDueToday(schedule);
              const overdue = isOverdue(schedule);
              const nextDate = getNextOrderDate(schedule);

              return (
                <Card
                  key={schedule.id}
                  className={`transition-all ${
                    overdue
                      ? 'border-red-400 bg-red-50 shadow-red-100 shadow-md'
                      : dueToday
                      ? 'border-yellow-400 bg-yellow-50 shadow-yellow-100 shadow-md'
                      : 'border-purple-200'
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{schedule.vendor.name}</CardTitle>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {overdue && (
                            <Badge className="bg-red-500 text-white">
                              Overdue
                            </Badge>
                          )}
                          {dueToday && !overdue && (
                            <Badge className="bg-yellow-500 text-white">
                              Due Today
                            </Badge>
                          )}
                          <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                            {schedule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(schedule)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(schedule.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Order Day:</span>
                        <span className="font-medium">{schedule.orderDay}</span>
                      </div>
                      {schedule.orderDeadline && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Order Deadline:
                          </span>
                          <span className={`font-semibold ${overdue ? 'text-red-600' : dueToday ? 'text-yellow-700' : 'text-purple-600'}`}>
                            {schedule.orderDeadline}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Delivery Day:</span>
                        <span className="font-medium">{schedule.deliveryDay || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Frequency:</span>
                        <span className="font-medium">{getFrequencyLabel(schedule.frequency, schedule.weekOffset)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Lead Time:</span>
                        <span className="font-medium">{schedule.leadTimeDays} {schedule.leadTimeDays === 1 ? 'day' : 'days'}</span>
                      </div>
                      {schedule.assignees && schedule.assignees.length > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">👤 Orders By:</span>
                          <div className="flex gap-1 flex-wrap justify-end">
                            {schedule.assignees.map((name: string) => (
                              <Badge key={name} variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {schedule.contactMethod && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Contact:</span>
                          <span className="font-medium text-gray-700">{schedule.contactMethod}</span>
                        </div>
                      )}
                      {schedule.trigger && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Trigger:</span>
                          <span className="font-medium text-orange-600 text-xs">{schedule.trigger}</span>
                        </div>
                      )}
                      {nextDate && (
                        <div className="flex justify-between pt-1 border-t border-gray-200">
                          <span className="text-gray-600">Next Order:</span>
                          <span className={`font-semibold ${
                            dueToday ? 'text-yellow-700' : 'text-purple-600'
                          }`}>
                            {dueToday ? 'Today' : nextDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      )}
                      {schedule.notes && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-gray-600 text-xs">{schedule.notes}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-2">
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules yet</h3>
                  <p className="text-gray-600 mb-4">
                    Create your first vendor order schedule to start automating your ordering process
                  </p>
                  <Button onClick={() => handleOpenDialog()} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingSchedule ? 'Edit Schedule' : 'Create Schedule'}
                </DialogTitle>
                <DialogDescription>
                  Set up a recurring order schedule for a vendor
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="col-span-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Select
                    value={formData.vendorId}
                    onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
                    disabled={!!editingSchedule}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorsData?.map((vendor: Vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="orderDay">Order Day</Label>
                  <Select
                    value={formData.orderDay}
                    onValueChange={(value) => setFormData({ ...formData, orderDay: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="orderDeadline">Order Deadline Time</Label>
                  <Select
                    value={formData.orderDeadline || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, orderDeadline: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No deadline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No deadline</SelectItem>
                      {DEADLINE_TIMES.filter(t => t.value).map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="deliveryDay">Delivery Day (Optional)</Label>
                  <Select
                    value={formData.deliveryDay || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, deliveryDay: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(formData.frequency === 'bi-weekly' || formData.frequency === 'fortnightly' || formData.frequency === 'monthly' || formData.frequency === 'six-weekly') && (
                  <div>
                    <Label htmlFor="weekOffset">Week Offset</Label>
                    <Select
                      value={formData.weekOffset.toString()}
                      onValueChange={(value) => setFormData({ ...formData, weekOffset: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Week 1</SelectItem>
                        <SelectItem value="1">Week 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
                  <Input
                    id="leadTimeDays"
                    type="number"
                    min="0"
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) })}
                    required
                  />
                </div>

                {/* Assignees - who handles this order */}
                <div className="col-span-2">
                  <Label>Assignees (who places this order)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {STAFF_MEMBERS.map((staff) => (
                      <button
                        key={staff}
                        type="button"
                        onClick={() => {
                          const current = formData.assignees || [];
                          const updated = current.includes(staff)
                            ? current.filter(s => s !== staff)
                            : [...current, staff];
                          setFormData({ ...formData, assignees: updated });
                        }}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          (formData.assignees || []).includes(staff)
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {staff}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="contactMethod">Contact Method</Label>
                  <Select
                    value={formData.contactMethod || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, contactMethod: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not specified" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_METHODS.map((method) => (
                        <SelectItem key={method.value || 'none'} value={method.value || 'none'}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Trigger field for when-needed orders */}
                {(formData.frequency === 'when-needed' || formData.orderType === 'when-needed') && (
                  <div>
                    <Label htmlFor="trigger">Order Trigger</Label>
                    <Input
                      id="trigger"
                      value={formData.trigger}
                      onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                      placeholder="e.g., When down to 2, When needed"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any special instructions or notes"
                  />
                </div>

                <div className="col-span-2">
                  <div className="flex items-center space-x-2">
                    <input
                      id="isActive"
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <Label htmlFor="isActive" className="cursor-pointer">
                      Active schedule
                    </Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingSchedule(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createSchedule.isPending || updateSchedule.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {createSchedule.isPending || updateSchedule.isPending
                    ? 'Saving...'
                    : editingSchedule
                    ? 'Update Schedule'
                    : 'Create Schedule'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
