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
    <>
      {/* Global Print Styles - These override everything when printing */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          
          /* Hide everything by default */
          body * {
            visibility: hidden;
          }
          
          /* Show only the printable area */
          #printable-timesheet,
          #printable-timesheet * {
            visibility: visible;
          }
          
          /* Position the printable area at top-left */
          #printable-timesheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
          }
          
          /* Remove all backgrounds and shadows */
          #printable-timesheet,
          #printable-timesheet * {
            background: white !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* Ensure black text */
          #printable-timesheet,
          #printable-timesheet * {
            color: black !important;
          }
        }
      `}</style>

      <DashboardLayout>
        {/* Screen Controls - Hidden when printing via visibility:hidden */}
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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

        {/* Printable Timesheet - This is the only thing that prints */}
        <div 
          id="printable-timesheet"
          style={{ 
            backgroundColor: 'white',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}
        >
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px',
            borderBottom: '2px solid black',
            paddingBottom: '6px'
          }}>
            <div>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Wild Octave Organics</span>
              <span style={{ fontSize: '14px', marginLeft: '16px' }}>Employee Timesheet</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontWeight: '600' }}>{employeeName || '_______________'}</span>
              <span style={{ marginLeft: '16px' }}>{MONTHS[selectedMonth]} {selectedYear}</span>
            </div>
          </div>

          {/* Compact Timesheet Grid */}
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '9px'
          }}>
            <thead>
              <tr>
                <th style={{ 
                  border: '1px solid black', 
                  padding: '2px 4px',
                  width: '40px',
                  fontWeight: '600',
                  backgroundColor: 'white'
                }}>Day</th>
                {days.map((d) => (
                  <th 
                    key={d.day}
                    style={{ 
                      border: '1px solid black', 
                      padding: '2px',
                      textAlign: 'center',
                      fontWeight: d.isWeekend ? 'bold' : 'normal',
                      backgroundColor: 'white'
                    }}
                  >
                    <div>{d.dayName}</div>
                    <div style={{ fontWeight: '600' }}>{d.day}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Start Time Row */}
              <tr>
                <td style={{ border: '1px solid black', padding: '2px 4px', fontWeight: '600', backgroundColor: 'white' }}>Start</td>
                {days.map((d) => (
                  <td key={`start-${d.day}`} style={{ border: '1px solid black', padding: '2px', height: '18px', backgroundColor: 'white' }}></td>
                ))}
              </tr>
              {/* End Time Row */}
              <tr>
                <td style={{ border: '1px solid black', padding: '2px 4px', fontWeight: '600', backgroundColor: 'white' }}>End</td>
                {days.map((d) => (
                  <td key={`end-${d.day}`} style={{ border: '1px solid black', padding: '2px', height: '18px', backgroundColor: 'white' }}></td>
                ))}
              </tr>
              {/* Break Checkbox Row */}
              <tr>
                <td style={{ border: '1px solid black', padding: '2px 4px', fontWeight: '600', backgroundColor: 'white' }}>Break?</td>
                {days.map((d) => (
                  <td key={`brk-${d.day}`} style={{ border: '1px solid black', padding: '2px', height: '14px', textAlign: 'center', backgroundColor: 'white' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      border: '1px solid black',
                      margin: '0 auto',
                      backgroundColor: 'white'
                    }}></div>
                  </td>
                ))}
              </tr>
              {/* Break Duration Row */}
              <tr>
                <td style={{ border: '1px solid black', padding: '2px 4px', fontWeight: '600', backgroundColor: 'white' }}>Brk Min</td>
                {days.map((d) => (
                  <td key={`brkm-${d.day}`} style={{ border: '1px solid black', padding: '2px', height: '14px', backgroundColor: 'white' }}></td>
                ))}
              </tr>
              {/* Hours Row */}
              <tr>
                <td style={{ border: '1px solid black', padding: '2px 4px', fontWeight: '600', backgroundColor: 'white' }}>Hours</td>
                {days.map((d) => (
                  <td key={`hrs-${d.day}`} style={{ border: '1px solid black', padding: '2px', height: '18px', backgroundColor: 'white' }}></td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <div style={{ 
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: '1px solid black',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px'
          }}>
            <div style={{ display: 'flex', gap: '32px' }}>
              <div>
                <span style={{ fontWeight: '600' }}>Total Hours:</span>
                <span style={{ 
                  display: 'inline-block', 
                  width: '60px', 
                  borderBottom: '1px solid black',
                  marginLeft: '4px'
                }}></span>
              </div>
              <div>
                <span style={{ fontWeight: '600' }}>Total Breaks:</span>
                <span style={{ 
                  display: 'inline-block', 
                  width: '60px', 
                  borderBottom: '1px solid black',
                  marginLeft: '4px'
                }}></span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '32px' }}>
              <div>
                <span>Employee Sig:</span>
                <span style={{ 
                  display: 'inline-block', 
                  width: '120px', 
                  borderBottom: '1px solid black',
                  marginLeft: '4px'
                }}></span>
              </div>
              <div>
                <span>Manager Sig:</span>
                <span style={{ 
                  display: 'inline-block', 
                  width: '120px', 
                  borderBottom: '1px solid black',
                  marginLeft: '4px'
                }}></span>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
