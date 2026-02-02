'use client';

import React, { useState, useRef } from 'react';
import { Printer, Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const EMPLOYEES = [
  'Heath',
  'Bec',
  'Katie',
  'Sarah',
  'Josh',
  'Emma',
  'Other'
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function TimesheetsPage() {
  const today = new Date();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [customEmployee, setCustomEmployee] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const printRef = useRef<HTMLDivElement>(null);

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);

  const employeeName = selectedEmployee === 'Other' ? customEmployee : selectedEmployee;

  const handlePrint = () => {
    window.print();
  };

  const changeMonth = (delta: number) => {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  // Generate array of days for the month
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(selectedYear, selectedMonth, i + 1);
    return {
      day: i + 1,
      dayName: DAY_NAMES[date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    };
  });

  // Split days into weeks for better layout (7 days per row)
  const weeksCount = Math.ceil(daysInMonth / 7);

  return (
    <DashboardLayout>
      {/* Screen Controls - Hidden when printing */}
      <div className="print:hidden mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Calendar className="w-7 h-7 text-emerald-600" />
          Employee Timesheets
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Employee Name
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Select employee...</option>
              {EMPLOYEES.map((emp) => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
            {selectedEmployee === 'Other' && (
              <input
                type="text"
                value={customEmployee}
                onChange={(e) => setCustomEmployee(e.target.value)}
                placeholder="Enter employee name..."
                className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            )}
          </div>

          {/* Month/Year Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Month & Year
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {MONTHS.map((month, idx) => (
                  <option key={month} value={idx}>{month}</option>
                ))}
              </select>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                min="2020"
                max="2030"
                className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Print Button */}
          <div className="flex items-end">
            <button
              onClick={handlePrint}
              disabled={!employeeName}
              className="w-full px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Printer className="w-5 h-5" />
              Print Timesheet
            </button>
          </div>
        </div>
      </div>

      {/* Printable Timesheet */}
      <div 
        ref={printRef}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 print:shadow-none print:border-none print:rounded-none print:p-0"
      >
        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        `}</style>

        {/* Header */}
        <div className="flex justify-between items-start mb-4 border-b-2 border-emerald-600 pb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Wild Octave Organics</h1>
            <p className="text-gray-600 text-sm">Employee Timesheet</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900">
              {employeeName || 'Employee Name'}
            </p>
            <p className="text-emerald-600 font-medium">
              {MONTHS[selectedMonth]} {selectedYear}
            </p>
          </div>
        </div>

        {/* Timesheet Table - Split into rows of 7 days */}
        <div className="space-y-3">
          {Array.from({ length: weeksCount }, (_, weekIndex) => {
            const weekDays = days.slice(weekIndex * 7, (weekIndex + 1) * 7);
            
            return (
              <div key={weekIndex} className="border border-gray-300 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      {weekDays.map((d) => (
                        <th 
                          key={d.day} 
                          className={`px-1 py-1 text-center border-r border-gray-300 last:border-r-0 ${d.isWeekend ? 'bg-gray-200' : ''}`}
                          style={{ width: `${100 / 7}%` }}
                        >
                          <div className="font-bold text-gray-900">{d.dayName}</div>
                          <div className="text-gray-600">{d.day}</div>
                        </th>
                      ))}
                      {/* Fill empty cells for incomplete weeks */}
                      {weekDays.length < 7 && Array.from({ length: 7 - weekDays.length }, (_, i) => (
                        <th key={`empty-${i}`} className="px-1 py-1 bg-gray-50 border-r border-gray-300 last:border-r-0" style={{ width: `${100 / 7}%` }}></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Start Time Row */}
                    <tr>
                      {weekDays.map((d) => (
                        <td key={`start-${d.day}`} className={`px-1 py-1 border-r border-gray-300 last:border-r-0 ${d.isWeekend ? 'bg-gray-50' : ''}`}>
                          <div className="text-[10px] text-gray-500 mb-0.5">Start</div>
                          <div className="h-5 border-b border-gray-300"></div>
                        </td>
                      ))}
                      {weekDays.length < 7 && Array.from({ length: 7 - weekDays.length }, (_, i) => (
                        <td key={`empty-start-${i}`} className="px-1 py-1 bg-gray-50 border-r border-gray-300 last:border-r-0"></td>
                      ))}
                    </tr>
                    {/* End Time Row */}
                    <tr>
                      {weekDays.map((d) => (
                        <td key={`end-${d.day}`} className={`px-1 py-1 border-r border-gray-300 last:border-r-0 ${d.isWeekend ? 'bg-gray-50' : ''}`}>
                          <div className="text-[10px] text-gray-500 mb-0.5">End</div>
                          <div className="h-5 border-b border-gray-300"></div>
                        </td>
                      ))}
                      {weekDays.length < 7 && Array.from({ length: 7 - weekDays.length }, (_, i) => (
                        <td key={`empty-end-${i}`} className="px-1 py-1 bg-gray-50 border-r border-gray-300 last:border-r-0"></td>
                      ))}
                    </tr>
                    {/* Break Row */}
                    <tr className="bg-amber-50/50">
                      {weekDays.map((d) => (
                        <td key={`break-${d.day}`} className={`px-1 py-1 border-r border-gray-300 last:border-r-0 ${d.isWeekend ? 'bg-gray-50' : ''}`}>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 border border-gray-400 rounded-sm flex-shrink-0"></div>
                            <span className="text-[9px] text-gray-500">Break</span>
                          </div>
                          <div className="h-4 border-b border-gray-300 mt-0.5"></div>
                        </td>
                      ))}
                      {weekDays.length < 7 && Array.from({ length: 7 - weekDays.length }, (_, i) => (
                        <td key={`empty-break-${i}`} className="px-1 py-1 bg-gray-50 border-r border-gray-300 last:border-r-0"></td>
                      ))}
                    </tr>
                    {/* Hours Row */}
                    <tr>
                      {weekDays.map((d) => (
                        <td key={`hours-${d.day}`} className={`px-1 py-1 border-r border-gray-300 last:border-r-0 ${d.isWeekend ? 'bg-gray-50' : ''}`}>
                          <div className="text-[10px] text-gray-500 mb-0.5">Hours</div>
                          <div className="h-5 border-b border-gray-300"></div>
                        </td>
                      ))}
                      {weekDays.length < 7 && Array.from({ length: 7 - weekDays.length }, (_, i) => (
                        <td key={`empty-hours-${i}`} className="px-1 py-1 bg-gray-50 border-r border-gray-300 last:border-r-0"></td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Footer - Summary & Signature */}
        <div className="mt-4 pt-3 border-t border-gray-300">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Monthly Totals</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between border-b border-gray-300 pb-1">
                  <span className="text-gray-600">Total Hours:</span>
                  <span className="w-16 border-b border-gray-400"></span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-1">
                  <span className="text-gray-600">Total Breaks:</span>
                  <span className="w-16 border-b border-gray-400"></span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Employee Signature</p>
              <div className="h-8 border-b border-gray-400"></div>
              <p className="text-xs text-gray-500 mt-1">Date: _______________</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Manager Signature</p>
              <div className="h-8 border-b border-gray-400"></div>
              <p className="text-xs text-gray-500 mt-1">Date: _______________</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
