'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface SimpleDatePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const QUICK_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'Last Month', value: 'lastMonth' },
];

export function SimpleDatePicker({ value, onChange, className = '' }: SimpleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      default:
        return { startDate: null, endDate: null };
    }
  };

  const handleQuickSelect = (type: string) => {
    const newRange = getDateRange(type);
    onChange(newRange);
    setIsOpen(false);
  };

  const getDisplayText = () => {
    if (!value.startDate && !value.endDate) return 'All time';
    if (value.startDate && value.endDate) {
      const start = value.startDate.toLocaleDateString();
      const end = value.endDate.toLocaleDateString();
      return start === end ? start : `${start} - ${end}`;
    }
    return 'Select dates';
  };

  const handleToggle = () => {
    if (!isOpen) {
      const button = document.getElementById('date-picker-button');
      if (button) {
        setButtonRect(button.getBoundingClientRect());
      }
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        id="date-picker-button"
        onClick={handleToggle}
        className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/20 rounded-md px-4 py-2 text-sm flex items-center justify-between"
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
            className="fixed z-[99999] w-80 bg-white border border-gray-200 rounded-lg shadow-2xl"
            style={{
              left: buttonRect.left,
              top: buttonRect.bottom + 8,
            }}
          >
            <div className="p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Quick select:</p>
              <div className="space-y-2">
                {QUICK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleQuickSelect(option.value)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-900 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 hover:border-gray-300 font-medium"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-3">Custom range:</p>
                <div className="space-y-2">
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    value={value.startDate ? value.startDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      onChange({ ...value, startDate: date });
                    }}
                  />
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    value={value.endDate ? value.endDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      onChange({ ...value, endDate: date });
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}