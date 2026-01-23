'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { X, Repeat, Calendar } from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
}

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: any) => Promise<void>;
  vendors: Vendor[];
  selectedDate?: string;
  existingOrder?: any;
  mode: 'create' | 'edit';
}

const STAFF_MEMBERS = [
  'Jackie',
  'Heath',
  'Charlotte',
  'Jasper',
  'Alexandra',
  'Tosh',
  'Katy',
  'Chilli',
  'Ceder',
  'Tiger',
  'Lux',
  'Leeia',
  'Lori',
  'Sacha',
];

const RECURRING_PATTERNS = [
  { value: 'none', label: 'One-off (No Repeat)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly (Every 2 weeks)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom Days' },
];

export function OrderModal({
  isOpen,
  onClose,
  onSave,
  vendors,
  selectedDate,
  existingOrder,
  mode,
}: OrderModalProps) {
  const [formData, setFormData] = useState({
    vendorId: '',
    deliveryDate: selectedDate || '',
    orderDeadline: '',
    orderedBy: '',
    notes: '',
    isRecurring: false,
    recurringPattern: 'none',
    recurringEndDate: '',
    customDays: [] as number[], // 0 = Sunday, 1 = Monday, etc.
  });
  const [editSeriesMode, setEditSeriesMode] = useState(true); // For recurring orders
  const [isSaving, setIsSaving] = useState(false);

  // Load existing order data when editing
  useEffect(() => {
    if (mode === 'edit' && existingOrder) {
      setFormData({
        vendorId: existingOrder.vendorId || '',
        deliveryDate: existingOrder.deliveryDate || '',
        orderDeadline: existingOrder.orderDeadline || '',
        orderedBy: existingOrder.orderedBy || '',
        notes: existingOrder.notes || '',
        isRecurring: existingOrder.isRecurring || false,
        recurringPattern: existingOrder.recurringPattern || 'none',
        recurringEndDate: existingOrder.recurringEndDate || '',
        customDays: existingOrder.customDays || [],
      });
    } else if (mode === 'create' && selectedDate) {
      setFormData({
        vendorId: '',
        deliveryDate: selectedDate,
        orderDeadline: '',
        orderedBy: '',
        notes: '',
        isRecurring: false,
        recurringPattern: 'none',
        recurringEndDate: '',
        customDays: [],
      });
    }
  }, [mode, existingOrder, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const orderData = {
        ...formData,
        editSeriesMode: mode === 'edit' && formData.isRecurring ? editSeriesMode : undefined,
        orderId: existingOrder?.id,
      };
      await onSave(orderData);
      onClose();
    } catch (error) {
      console.error('Error saving order:', error);
      alert('Failed to save order. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter(d => d !== day)
        : [...prev.customDays, day].sort(),
    }));
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <span>{mode === 'create' ? 'Create New Order' : 'Edit Order'}</span>
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Schedule a new order for delivery. Choose one-off or recurring pattern.'
              : 'Update order details. For recurring orders, choose to edit this occurrence or entire series.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Edit Series Mode (only for editing recurring orders) */}
          {mode === 'edit' && existingOrder?.isRecurring && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="editSeriesMode"
                  checked={editSeriesMode}
                  onCheckedChange={(checked) => setEditSeriesMode(checked as boolean)}
                />
                <div className="flex-1">
                  <Label htmlFor="editSeriesMode" className="text-amber-900 font-medium cursor-pointer">
                    Edit entire series
                  </Label>
                  <p className="text-sm text-amber-700 mt-1">
                    {editSeriesMode
                      ? 'Changes will apply to all future occurrences of this recurring order'
                      : 'Changes will only apply to this single occurrence'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Vendor Selection */}
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor *</Label>
            <Select
              value={formData.vendorId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, vendorId: value }))}
              required
            >
              <SelectTrigger id="vendor">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Delivery Date */}
          <div className="space-y-2">
            <Label htmlFor="deliveryDate">Delivery Date *</Label>
            <Input
              id="deliveryDate"
              type="date"
              value={formData.deliveryDate}
              onChange={(e) => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
              required
            />
          </div>

          {/* Order Deadline */}
          <div className="space-y-2">
            <Label htmlFor="orderDeadline">Order Deadline (Time)</Label>
            <Input
              id="orderDeadline"
              type="time"
              value={formData.orderDeadline}
              onChange={(e) => setFormData(prev => ({ ...prev, orderDeadline: e.target.value }))}
              placeholder="e.g., 12:00"
            />
            <p className="text-xs text-gray-600">
              Time by which order must be placed (e.g., 12:00 PM)
            </p>
          </div>

          {/* Ordered By */}
          <div className="space-y-2">
            <Label htmlFor="orderedBy">Ordered By</Label>
            <Select
              value={formData.orderedBy}
              onValueChange={(value) => setFormData(prev => ({ ...prev, orderedBy: value }))}
            >
              <SelectTrigger id="orderedBy">
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {STAFF_MEMBERS.map((staff) => (
                  <SelectItem key={staff} value={staff}>
                    {staff}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recurring Options */}
          <div className="space-y-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="isRecurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    isRecurring: checked as boolean,
                    recurringPattern: checked ? 'weekly' : 'none'
                  }))
                }
              />
              <div>
                <Label htmlFor="isRecurring" className="text-purple-900 font-medium cursor-pointer flex items-center space-x-2">
                  <Repeat className="h-4 w-4" />
                  <span>Recurring Order</span>
                </Label>
                <p className="text-sm text-purple-700">
                  This order repeats on a regular schedule
                </p>
              </div>
            </div>

            {formData.isRecurring && (
              <div className="space-y-4 pl-7">
                {/* Recurring Pattern */}
                <div className="space-y-2">
                  <Label htmlFor="recurringPattern">Repeat Pattern *</Label>
                  <Select
                    value={formData.recurringPattern}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, recurringPattern: value }))}
                  >
                    <SelectTrigger id="recurringPattern">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRING_PATTERNS.filter(p => p.value !== 'none').map((pattern) => (
                        <SelectItem key={pattern.value} value={pattern.value}>
                          {pattern.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Days Selector */}
                {formData.recurringPattern === 'custom' && (
                  <div className="space-y-2">
                    <Label>Select Days of Week *</Label>
                    <div className="flex flex-wrap gap-2">
                      {dayNames.map((day, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleDayToggle(index)}
                          className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                            formData.customDays.includes(index)
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* End Date */}
                <div className="space-y-2">
                  <Label htmlFor="recurringEndDate">Repeat Until (Optional)</Label>
                  <Input
                    id="recurringEndDate"
                    type="date"
                    value={formData.recurringEndDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, recurringEndDate: e.target.value }))}
                    min={formData.deliveryDate}
                  />
                  <p className="text-xs text-purple-700">
                    Leave empty to repeat indefinitely
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any special instructions or notes..."
              rows={3}
            />
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={isSaving || !formData.vendorId || !formData.deliveryDate}
            >
              {isSaving ? 'Saving...' : mode === 'create' ? 'Create Order' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
