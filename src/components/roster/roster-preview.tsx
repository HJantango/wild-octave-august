'use client';

import { forwardRef } from 'react';
import { formatCurrency } from '@/lib/format';
import { useWhiteLabelSettings } from '@/hooks/useSettings';

interface Staff {
  id: string;
  name: string;
  role: string;
  baseHourlyRate: number;
  isActive: boolean;
}

interface RosterShift {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes?: string;
  role?: string;
  isBackupBarista?: boolean;
  staff: Staff;
}

interface Roster {
  id: string;
  weekStartDate: string;
  status: string;
  shifts: RosterShift[];
}

interface RosterPreviewProps {
  roster: Roster | null;
  staff: Staff[];
  weekStartDate: Date;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper function to get role color
const getRoleColor = (role: string, isBackupBarista: boolean = false) => {
  if (isBackupBarista) {
    return 'bg-purple-100 border-purple-200';
  }
  
  switch (role?.toLowerCase()) {
    case 'manager':
      return 'bg-green-100 border-green-200';
    case 'close':
      return 'bg-red-100 border-red-200';
    case 'barista':
      return 'bg-blue-100 border-blue-200';
    case 'kitchen':
    case 'kitchen staff':
      return 'bg-orange-100 border-orange-200';
    case 'counter/roam':
      return 'bg-pink-100 border-pink-200';
    case 'junior':
      return 'bg-yellow-100 border-yellow-200';
    case 'admin':
    case 'check-in/admin':
      return 'bg-indigo-100 border-indigo-200';
    default:
      return 'bg-gray-100 border-gray-200';
  }
};

// Helper function to format date
const formatDate = (date: Date, dayOffset: number): string => {
  const targetDate = new Date(date);
  targetDate.setDate(date.getDate() + dayOffset);
  return targetDate.toLocaleDateString('en-AU', { 
    day: '2-digit', 
    month: '2-digit' 
  });
};

export const RosterPreview = forwardRef<HTMLDivElement, RosterPreviewProps>(
  ({ roster, staff, weekStartDate }, ref) => {
    const { companyName } = useWhiteLabelSettings();
    // Get shifts for a specific staff member and day
    const getShiftsForStaffAndDay = (staffId: string, dayIndex: number): RosterShift[] => {
      if (!roster) return [];
      // dayIndex: 0=Monday, 1=Tuesday, ..., 6=Sunday
      // Database dayOfWeek: 1=Monday, 2=Tuesday, ..., 0=Sunday
      const targetDayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1;
      return roster.shifts.filter(s => s.staffId === staffId && s.dayOfWeek === targetDayOfWeek);
    };

    // Get active staff who have shifts this week
    const activeStaff = staff
      .filter(s => s.isActive)
      .filter(s => {
        // Check if this staff member has any shifts in the current roster
        if (!roster) return false;
        return roster.shifts.some(shift => shift.staffId === s.id);
      })
      .sort((a, b) => {
        const aIsJunior = a.role.toLowerCase().includes('junior');
        const bIsJunior = b.role.toLowerCase().includes('junior');
        if (aIsJunior !== bIsJunior) {
          return aIsJunior ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });


    return (
      <div ref={ref} className="bg-white p-8 min-h-screen">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-lg">★</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{companyName} Roster</h1>
          </div>
          <div className="text-lg text-gray-900 mb-6">
            Week of {weekStartDate.toLocaleDateString('en-AU', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </div>
          
        </div>

        {/* Roster Table */}
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-8 bg-gray-100">
            <div className="p-3 font-bold text-gray-900 border-r border-gray-300">Staff</div>
            {DAYS.map((day, index) => (
              <div key={day} className="p-3 text-center border-r border-gray-300 last:border-r-0">
                <div className="font-bold text-gray-900">{day}</div>
                <div className="text-sm text-gray-900">{formatDate(weekStartDate, index)}</div>
              </div>
            ))}
          </div>

          {/* Staff Rows */}
          {activeStaff.map((person) => (
            <div key={person.id} className="grid grid-cols-8 border-t border-gray-200">
              {/* Staff Name Column */}
              <div className="p-3 border-r border-gray-300 bg-gray-50">
                <div className="font-semibold text-gray-900">{person.name}</div>
                <div className="text-sm text-gray-900">{person.role}</div>
              </div>

              {/* Day Columns */}
              {DAYS.map((day, dayIndex) => {
                const shifts = getShiftsForStaffAndDay(person.id, dayIndex);
                return (
                  <div key={day} className="p-2 border-r border-gray-300 last:border-r-0 min-h-[80px]">
                    {shifts.map((shift) => (
                      <div
                        key={shift.id}
                        className={`${getRoleColor(shift.role || person.role, shift.isBackupBarista)} rounded p-2 mb-1 last:mb-0 border`}
                      >
                        <div className="font-semibold text-sm text-gray-900">
                          {shift.startTime}-{shift.endTime}
                        </div>
                        {shift.role && shift.role !== person.role && (
                          <div className="text-xs text-gray-900 capitalize">
                            {shift.role}
                          </div>
                        )}
                        {shift.isBackupBarista && (
                          <div className="text-xs text-purple-600 font-medium">
                            Backup Barista
                          </div>
                        )}
                        {shift.notes && (
                          <div className="text-xs text-gray-900 mt-1">
                            {shift.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 grid grid-cols-4 gap-4 text-sm text-gray-900">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-100 border border-green-200 rounded mr-2"></div>
            <span>Manager</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded mr-2"></div>
            <span>Barista</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-purple-100 border border-purple-200 rounded mr-2"></div>
            <span>Backup Barista</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded mr-2"></div>
            <span>Junior</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded mr-2"></div>
            <span>Kitchen</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-pink-100 border border-pink-200 rounded mr-2"></div>
            <span>Counter/Roam</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-100 border border-red-200 rounded mr-2"></div>
            <span>Close</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-indigo-100 border border-indigo-200 rounded mr-2"></div>
            <span>Admin</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-900">
          Generated on {new Date().toLocaleDateString('en-AU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    );
  }
);

RosterPreview.displayName = 'RosterPreview';