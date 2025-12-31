'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';

interface Staff {
  id: string;
  name: string;
  role: string;
  baseHourlyRate: number;
  isActive: boolean;
}

interface RosterShift {
  id?: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes?: string;
  role?: string;
  isBackupBarista?: boolean;
  staff?: Staff;
}

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shift: Omit<RosterShift, 'id'>) => void;
  shift?: RosterShift | null;
  staff: Staff[];
  dayOfWeek: number;
  dayName: string;
  preselectedStaffId?: string | null;
  existingShifts?: RosterShift[];
}

export function ShiftModal({
  isOpen,
  onClose,
  onSave,
  shift,
  staff,
  dayOfWeek,
  dayName,
  preselectedStaffId,
  existingShifts = []
}: ShiftModalProps) {
  const toast = useToast();
  const [staffId, setStaffId] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:30');
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [shiftRole, setShiftRole] = useState('');
  const [isBackupBarista, setIsBackupBarista] = useState(false);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (shift) {
      setStaffId(shift.staffId);
      setStartTime(shift.startTime);
      setEndTime(shift.endTime);
      setBreakMinutes(shift.breakMinutes);
      setShiftRole(shift.role || '');
      setIsBackupBarista(shift.isBackupBarista || false);
      setNotes(shift.notes || '');
    } else {
      setStaffId(preselectedStaffId || '');
      setStartTime('08:00');
      setEndTime('16:30');
      setBreakMinutes(30);
      setShiftRole('');
      setIsBackupBarista(false);
      setNotes('');
    }
  }, [shift, isOpen, preselectedStaffId]);

  const handleSave = async () => {
    if (!staffId) {
      toast.error('Validation Error', 'Please select a staff member');
      return;
    }

    if (startTime >= endTime) {
      toast.error('Validation Error', 'Start time must be before end time');
      return;
    }

    setIsLoading(true);
    try {
      const shiftData: Omit<RosterShift, 'id'> = {
        staffId,
        dayOfWeek,
        startTime,
        endTime,
        breakMinutes,
        role: shiftRole,
        isBackupBarista,
        notes: notes.trim() || undefined
      };

      await onSave(shiftData);
      onClose();
    } catch (error) {
      console.error('Error saving shift:', error);
      toast.error('Save Failed', 'Failed to save shift. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDuration = () => {
    const start = new Date(`2000-01-01 ${startTime}:00`);
    const end = new Date(`2000-01-01 ${endTime}:00`);
    const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const workedMinutes = totalMinutes - breakMinutes;
    return (workedMinutes / 60).toFixed(1);
  };

  const isPenaltyRate = dayOfWeek === 6 || dayOfWeek === 0; // Saturday or Sunday

  // Get previous shifts for the selected staff member
  const getPreviousShifts = () => {
    if (!staffId) return [];
    return existingShifts
      .filter(s => s.staffId === staffId && s.dayOfWeek !== dayOfWeek)
      .sort((a, b) => {
        // Sort by most recent day, wrapping around the week
        const aDayDiff = dayOfWeek - a.dayOfWeek;
        const bDayDiff = dayOfWeek - b.dayOfWeek;
        const aDistance = aDayDiff > 0 ? aDayDiff : aDayDiff + 7;
        const bDistance = bDayDiff > 0 ? bDayDiff : bDayDiff + 7;
        return aDistance - bDistance;
      });
  };

  const copyFromShift = (sourceShift: RosterShift) => {
    setStartTime(sourceShift.startTime);
    setEndTime(sourceShift.endTime);
    setBreakMinutes(sourceShift.breakMinutes);
    setShiftRole(sourceShift.role || '');
    setIsBackupBarista(sourceShift.isBackupBarista || false);
    setNotes(sourceShift.notes || '');
  };

  const resetToDefaults = () => {
    setStartTime('08:00');
    setEndTime('16:30');
    setBreakMinutes(30);
    setShiftRole('');
    setIsBackupBarista(false);
    setNotes('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {shift ? 'Edit Shift' : 'Add Shift'} - {dayName}
          </DialogTitle>
          <DialogDescription>
            {isPenaltyRate && (
              <span className="text-yellow-600 font-medium">
                ⚠️ {dayOfWeek === 6 ? '1.5x' : '2x'} penalty rates apply for {dayName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 overflow-y-auto max-h-[60vh]">
          <div className="grid gap-2">
            <Label htmlFor="staff">Staff Member</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {staff.filter(s => s.isActive).map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name} ({person.role} - ${person.baseHourlyRate}/hr)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Copy from Previous Shifts */}
          {!shift && staffId && getPreviousShifts().length > 0 && (
            <div className="grid gap-2">
              <Label>Copy from Previous Shifts</Label>
              <div className="flex flex-wrap gap-2">
                {getPreviousShifts().slice(0, 3).map((prevShift) => {
                  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                  const staffMember = staff.find(s => s.id === prevShift.staffId);
                  return (
                    <Button
                      key={prevShift.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyFromShift(prevShift)}
                      className="text-xs"
                    >
                      📋 {dayNames[prevShift.dayOfWeek]} {prevShift.startTime}-{prevShift.endTime}
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                  className="text-xs"
                >
                  🆕 New Shift
                </Button>
              </div>
            </div>
          )}

          {/* Shift Shortcuts */}
          <div className="grid gap-2">
            <Label>Quick Shift Templates</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartTime('07:30');
                  setEndTime('15:30');
                  setShiftRole('barista');
                }}
              >
                Barista 7:30-3:30
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartTime('16:00');
                  setEndTime('18:00');
                  setShiftRole('junior');
                }}
              >
                Junior 4-6
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartTime('10:00');
                  setEndTime('18:00');
                  setShiftRole('close');
                }}
              >
                Close 10-6
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartTime('07:00');
                  setEndTime('15:00');
                  setShiftRole('barista');
                }}
              >
                Open 7-3
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 48 }, (_, i) => {
                    const hour = Math.floor(i / 2);
                    const minute = i % 2 === 0 ? '00' : '30';
                    const time = `${hour.toString().padStart(2, '0')}:${minute}`;
                    return (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="endTime">End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 48 }, (_, i) => {
                    const hour = Math.floor(i / 2);
                    const minute = i % 2 === 0 ? '00' : '30';
                    const time = `${hour.toString().padStart(2, '0')}:${minute}`;
                    return (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="breakMinutes">Break Duration (minutes)</Label>
            <Select value={breakMinutes.toString()} onValueChange={(value) => setBreakMinutes(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No break</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select value={shiftRole} onValueChange={setShiftRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role for this shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barista">Barista</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="close">Close</SelectItem>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="counter/roam">Counter/Roam</SelectItem>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="admin">Check-in/Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="backupBarista"
              type="checkbox"
              checked={isBackupBarista}
              onChange={(e) => setIsBackupBarista(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="backupBarista" className="text-sm font-normal">
              Backup Barista (for breaks/end of day)
            </Label>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special notes for this shift..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {startTime && endTime && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-blue-900">
                Shift Duration: {calculateDuration()} hours worked
              </div>
              <div className="text-xs text-blue-700">
                ({((new Date(`2000-01-01 ${endTime}:00`).getTime() - new Date(`2000-01-01 ${startTime}:00`).getTime()) / (1000 * 60))} total minutes - {breakMinutes} break minutes)
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : shift ? 'Update Shift' : 'Add Shift'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}