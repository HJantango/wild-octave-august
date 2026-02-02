'use client';

import React, { useState, useEffect } from 'react';
import { Printer, Calendar, User, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface Staff {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_ABBREV = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export default function TimesheetsPage() {
  const today = new Date();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [customEmployee, setCustomEmployee] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  useEffect(() => {
    async function fetchStaff() {
      try {
        const res = await fetch('/api/roster/staff');
        const data = await res.json();
        if (data.success) {
          setStaff(data.data.filter((s: Staff) => s.isActive));
        }
      } catch (err) {
        console.error('Failed to fetch staff:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStaff();
  }, []);

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
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
      dayName: DAY_ABBREV[date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    };
  });

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
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading staff...
              </div>
            ) : (
              <>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select employee...</option>
                  {staff.map((emp) => (
                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                  ))}
                  <option value="Other">Other...</option>
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
              </>
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

      {/* Printable Timesheet - Compact A4 Landscape */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 print:shadow-none print:border-none print:rounded-none print:p-0">
        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            @page {
              size: A4 landscape;
              margin: 8mm;
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
        <div className="flex justify-between items-center mb-2 border-b border-black pb-1">
          <div>
            <span className="text-base font-bold">Wild Octave Organics</span>
            <span className="text-sm ml-4">Employee Timesheet</span>
          </div>
          <div className="text-right">
            <span className="font-semibold">{employeeName || '_______________'}</span>
            <span className="ml-4">{MONTHS[selectedMonth]} {selectedYear}</span>
          </div>
        </div>

        {/* Compact Timesheet Grid - All days in one table */}
        <table className="w-full border-collapse text-[10px] print:text-[9px]">
          <thead>
            <tr>
              <th className="border border-black p-0.5 w-12 font-semibold">Day</th>
              {days.map((d) => (
                <th 
                  key={d.day} 
                  className={`border border-black p-0.5 text-center font-normal ${d.isWeekend ? 'font-bold' : ''}`}
                >
                  <div>{d.dayName}</div>
                  <div className="font-semibold">{d.day}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Start Time Row */}
            <tr>
              <td className="border border-black p-0.5 font-semibold">Start</td>
              {days.map((d) => (
                <td key={`start-${d.day}`} className="border border-black p-0.5 h-5"></td>
              ))}
            </tr>
            {/* End Time Row */}
            <tr>
              <td className="border border-black p-0.5 font-semibold">End</td>
              {days.map((d) => (
                <td key={`end-${d.day}`} className="border border-black p-0.5 h-5"></td>
              ))}
            </tr>
            {/* Break Checkbox Row */}
            <tr>
              <td className="border border-black p-0.5 font-semibold">Break?</td>
              {days.map((d) => (
                <td key={`brk-${d.day}`} className="border border-black p-0.5 h-4 text-center">
                  <div className="w-2.5 h-2.5 border border-black mx-auto"></div>
                </td>
              ))}
            </tr>
            {/* Break Duration Row */}
            <tr>
              <td className="border border-black p-0.5 font-semibold">Brk Mins</td>
              {days.map((d) => (
                <td key={`brkm-${d.day}`} className="border border-black p-0.5 h-4"></td>
              ))}
            </tr>
            {/* Hours Row */}
            <tr>
              <td className="border border-black p-0.5 font-semibold">Hours</td>
              {days.map((d) => (
                <td key={`hrs-${d.day}`} className="border border-black p-0.5 h-5"></td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* Footer - Compact */}
        <div className="mt-3 pt-2 border-t border-black flex justify-between text-[11px]">
          <div className="flex gap-8">
            <div>
              <span className="font-semibold">Total Hours:</span>
              <span className="inline-block w-16 border-b border-black ml-1"></span>
            </div>
            <div>
              <span className="font-semibold">Total Breaks:</span>
              <span className="inline-block w-16 border-b border-black ml-1"></span>
            </div>
          </div>
          <div className="flex gap-8">
            <div>
              <span>Employee Sig:</span>
              <span className="inline-block w-32 border-b border-black ml-1"></span>
            </div>
            <div>
              <span>Manager Sig:</span>
              <span className="inline-block w-32 border-b border-black ml-1"></span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
