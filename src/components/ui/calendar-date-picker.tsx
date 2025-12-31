'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface CalendarDatePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const QUICK_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Q1 (Jul-Sep)', value: 'q1' },
  { label: 'Q2 (Oct-Dec)', value: 'q2' },
  { label: 'Q3 (Jan-Mar)', value: 'q3' },
  { label: 'Q4 (Apr-Jun)', value: 'q4' },
  { label: 'Last Year', value: 'lastYear' },
  { label: 'All Time', value: 'allTime' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarDatePicker({ value, onChange, className = '' }: CalendarDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getAusFinancialYear = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return month >= 6 ? year : year - 1;
  };

  const getDateRange = (type: string): DateRange => {
    const now = new Date();
    
    switch (type) {
      case 'today':
        return { startDate: now, endDate: now };
      case 'thisWeek':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return { startDate: startOfWeek, endDate: endOfWeek };
      case 'lastWeek':
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(now.getDate() - now.getDay() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        return { startDate: lastWeekStart, endDate: lastWeekEnd };
      case 'lastMonth':
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { startDate: start, endDate: end };
      case 'q1':
        const finYear = getAusFinancialYear(now);
        return {
          startDate: new Date(finYear, 6, 1), // July 1
          endDate: new Date(finYear, 8, 30) // September 30
        };
      case 'q2':
        const finYear2 = getAusFinancialYear(now);
        return {
          startDate: new Date(finYear2, 9, 1), // October 1
          endDate: new Date(finYear2, 11, 31) // December 31
        };
      case 'q3':
        const finYear3 = getAusFinancialYear(now);
        return {
          startDate: new Date(finYear3 + 1, 0, 1), // January 1
          endDate: new Date(finYear3 + 1, 2, 31) // March 31
        };
      case 'q4':
        const finYear4 = getAusFinancialYear(now);
        return {
          startDate: new Date(finYear4 + 1, 3, 1), // April 1
          endDate: new Date(finYear4 + 1, 5, 30) // June 30
        };
      case 'lastYear':
        const finYear5 = getAusFinancialYear(now) - 1;
        return {
          startDate: new Date(finYear5, 6, 1), // July 1 of previous fin year
          endDate: new Date(finYear5 + 1, 5, 30) // June 30 of previous fin year
        };
      case 'allTime':
        return { startDate: null, endDate: null };
      default:
        return { startDate: null, endDate: null };
    }
  };

  const handleQuickSelect = (type: string) => {
    const newRange = getDateRange(type);
    onChange(newRange);
    setIsOpen(false);
    setSelectingStart(true);
  };

  const handleToggle = () => {
    if (!isOpen) {
      const button = document.getElementById('calendar-picker-button');
      if (button) {
        setButtonRect(button.getBoundingClientRect());
      }
    }
    setIsOpen(!isOpen);
    setSelectingStart(true);
  };

  const getDisplayText = () => {
    if (!value.startDate && !value.endDate) return 'All time';
    if (value.startDate && value.endDate) {
      const start = value.startDate.toLocaleDateString();
      const end = value.endDate.toLocaleDateString();
      return start === end ? start : `${start} - ${end}`;
    }
    if (value.startDate) return `From ${value.startDate.toLocaleDateString()}`;
    if (value.endDate) return `Until ${value.endDate.toLocaleDateString()}`;
    return 'Select dates';
  };

  const handleDateClick = (date: Date) => {
    const clickedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (!value.startDate || selectingStart) {
      // First click or starting over - always set start date
      onChange({ startDate: clickedDate, endDate: null });
      setSelectingStart(false);
    } else if (!value.endDate) {
      // Second click - set end date
      if (clickedDate.getTime() === value.startDate.getTime()) {
        // Same date clicked - make it a single-day range
        onChange({ startDate: value.startDate, endDate: clickedDate });
        setSelectingStart(true);
      } else if (clickedDate < value.startDate) {
        // Earlier date clicked - make it the new start, previous start becomes end
        onChange({ startDate: clickedDate, endDate: value.startDate });
        setSelectingStart(true);
      } else {
        // Later date clicked - make it the end
        onChange({ startDate: value.startDate, endDate: clickedDate });
        setSelectingStart(true);
      }
    } else {
      // Both dates already selected - start over with new start date
      onChange({ startDate: clickedDate, endDate: null });
      setSelectingStart(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const isDateInRange = (date: Date) => {
    if (!value.startDate || !value.endDate) return false;
    return date >= value.startDate && date <= value.endDate;
  };

  const isDateSelected = (date: Date) => {
    return (value.startDate && date.toDateString() === value.startDate.toDateString()) ||
           (value.endDate && date.toDateString() === value.endDate.toDateString());
  };

  const navigateMonth = (direction: 1 | -1) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  return (
    <div className={`relative ${className}`}>
      <button
        id="calendar-picker-button"
        onClick={handleToggle}
        className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/20 rounded-lg px-4 py-2.5 text-base font-medium flex items-center justify-between transition-all duration-200 shadow-sm"
      >
        <div className="flex items-center space-x-2">
          <span>📅</span>
          <span>{getDisplayText()}</span>
        </div>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && mounted && buttonRect && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[99998] bg-black/10" 
            onClick={() => setIsOpen(false)}
          />
          <div 
            className="fixed z-[99999] w-96 bg-white border border-gray-200 rounded-xl shadow-2xl backdrop-blur-sm"
            style={{
              left: Math.min(buttonRect.left, window.innerWidth - 400),
              top: buttonRect.bottom + 8,
            }}
          >
            <div className="p-4">
              {/* Quick Select Section */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Quick select:</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleQuickSelect(option.value)}
                      className="px-2 py-1 text-xs text-gray-800 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 hover:border-gray-300 font-medium text-center"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendar Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => navigateMonth(-1)}
                    className="p-2 hover:bg-gray-100 rounded text-gray-600"
                  >
                    ←
                  </button>
                  <h3 className="text-sm font-semibold text-gray-800">
                    {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h3>
                  <button
                    onClick={() => navigateMonth(1)}
                    className="p-2 hover:bg-gray-100 rounded text-gray-600"
                  >
                    →
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map(day => (
                    <div key={day} className="text-xs font-medium text-gray-500 text-center p-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth(currentMonth).map((date, index) => (
                    <div key={index} className="aspect-square">
                      {date ? (
                        <button
                          onClick={() => handleDateClick(date)}
                          className={`
                            w-full h-full text-xs rounded flex items-center justify-center
                            ${isDateSelected(date) 
                              ? 'bg-blue-500 text-white font-semibold' 
                              : isDateInRange(date)
                              ? 'bg-blue-100 text-blue-800'
                              : 'hover:bg-gray-100 text-gray-700'}
                          `}
                        >
                          {date.getDate()}
                        </button>
                      ) : (
                        <div></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  {!value.startDate ? 'Select start date' : 
                   !value.endDate ? 'Select end date' : 
                   'Click a date to start over'}
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      onChange({ startDate: null, endDate: null });
                      setSelectingStart(true);
                    }}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setSelectingStart(true);
                    }}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setSelectingStart(true);
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}