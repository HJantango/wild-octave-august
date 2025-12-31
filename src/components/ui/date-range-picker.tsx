'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const getAusFinancialYear = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  // Australian financial year runs July 1 to June 30
  return month >= 6 ? year : year - 1;
};

const QUICK_RANGES = [
  {
    label: 'Today',
    getValue: () => {
      const today = new Date();
      return { startDate: today, endDate: today };
    }
  },
  {
    label: 'This Week',
    getValue: () => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Saturday)
      return { startDate: startOfWeek, endDate: endOfWeek };
    }
  },
  {
    label: 'Last Week',
    getValue: () => {
      const now = new Date();
      const lastWeekEnd = new Date(now);
      lastWeekEnd.setDate(now.getDate() - now.getDay() - 1); // Last Saturday
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6); // Previous Sunday
      return { startDate: lastWeekStart, endDate: lastWeekEnd };
    }
  },
  {
    label: 'Last Month',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Quarter 1',
    getValue: () => {
      const now = new Date();
      const finYear = getAusFinancialYear(now);
      const start = new Date(finYear, 6, 1); // July 1
      const end = new Date(finYear, 8, 30); // September 30
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Quarter 2',
    getValue: () => {
      const now = new Date();
      const finYear = getAusFinancialYear(now);
      const start = new Date(finYear, 9, 1); // October 1
      const end = new Date(finYear, 11, 31); // December 31
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Quarter 3',
    getValue: () => {
      const now = new Date();
      const finYear = getAusFinancialYear(now);
      const start = new Date(finYear + 1, 0, 1); // January 1
      const end = new Date(finYear + 1, 2, 31); // March 31
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Quarter 4',
    getValue: () => {
      const now = new Date();
      const finYear = getAusFinancialYear(now);
      const start = new Date(finYear + 1, 3, 1); // April 1
      const end = new Date(finYear + 1, 5, 30); // June 30
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Last Year',
    getValue: () => {
      const now = new Date();
      const finYear = getAusFinancialYear(now) - 1;
      const start = new Date(finYear, 6, 1); // July 1 of previous fin year
      const end = new Date(finYear + 1, 5, 30); // June 30 of previous fin year
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'All time',
    getValue: () => ({ startDate: null, endDate: null })
  }
];

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const handleStartDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = event.target.value;
    const startDate = dateValue ? new Date(dateValue) : null;
    onChange({ ...value, startDate });
  };

  const handleEndDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = event.target.value;
    const endDate = dateValue ? new Date(dateValue) : null;
    onChange({ ...value, endDate });
  };

  const handleQuickRange = (range: DateRange) => {
    onChange(range);
    setIsOpen(false);
  };

  const getDisplayText = () => {
    if (!value.startDate && !value.endDate) {
      return 'All time';
    }
    if (value.startDate && value.endDate) {
      const start = value.startDate.toLocaleDateString();
      const end = value.endDate.toLocaleDateString();
      if (start === end) {
        return start;
      }
      return `${start} - ${end}`;
    }
    if (value.startDate) {
      return `From ${value.startDate.toLocaleDateString()}`;
    }
    if (value.endDate) {
      return `Until ${value.endDate.toLocaleDateString()}`;
    }
    return 'Select dates';
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between bg-white hover:bg-gray-50 border-white/50"
      >
        <div className="flex items-center space-x-2">
          <span className="text-white/80">📅</span>
          <span className="text-sm text-white/90">{getDisplayText()}</span>
        </div>
        <span className="text-white/60">
          {isOpen ? '▲' : '▼'}
        </span>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          ></div>
          
          {/* Popover */}
          <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-80 max-w-sm">
            <div className="p-4">
              {/* Quick Range Buttons */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Quick select:</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_RANGES.map((range, index) => {
                    console.log('Rendering quick range button:', range.label);
                    return (
                      <Button
                        key={range.label}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          console.log('Quick range clicked:', range.label);
                          handleQuickRange(range.getValue());
                        }}
                        className="text-left justify-start text-xs hover:bg-gray-100 py-2 min-h-[32px] border border-gray-200 hover:border-gray-300"
                      >
                        {range.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Custom range:</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start date</label>
                    <Input
                      type="date"
                      value={formatDateForInput(value.startDate)}
                      onChange={handleStartDateChange}
                      className="text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End date</label>
                    <Input
                      type="date"
                      value={formatDateForInput(value.endDate)}
                      onChange={handleEndDateChange}
                      className="text-sm w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}