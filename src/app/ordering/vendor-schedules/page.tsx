'use client';

import { useState } from 'react';
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
import { Calendar, Plus, Edit, Trash2, RefreshCw } from 'lucide-react';

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
  notes: string;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-monthly', label: 'Bi-monthly' },
];

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
    if (frequency === 'bi-weekly' || frequency === 'fortnightly' || frequency === 'monthly') {
      return `${freq?.label} (Week ${weekOffset + 1})`;
    }
    return freq?.label || frequency;
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

        {/* Schedules List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isLoading ? (
            <div className="col-span-2 flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-purple-600" />
                <p className="text-gray-600">Loading schedules...</p>
              </div>
            </div>
          ) : schedulesData && schedulesData.length > 0 ? (
            schedulesData.map((schedule: VendorSchedule) => (
              <Card key={schedule.id} className="border-purple-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-lg">{schedule.vendor.name}</CardTitle>
                      <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                        {schedule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
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
                    {schedule.notes && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-gray-600 text-xs">{schedule.notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
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

                {(formData.frequency === 'bi-weekly' || formData.frequency === 'fortnightly' || formData.frequency === 'monthly') && (
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
