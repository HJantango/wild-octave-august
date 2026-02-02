'use client';

import React, { useState, useEffect } from 'react';
import { Printer, Calendar, User, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
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

// Single timesheet component - fills 1/3 of A4 landscape page
function TimesheetCard({ employeeName, month, year, days }: { 
  employeeName: string; 
  month: number; 
  year: number;
  days: { day: number; dayName: string; isWeekend: boolean }[];
}) {
  return (
    <div style={{ 
      backgroundColor: 'white',
      height: '63mm', // 1/3 of printable A4 landscape height (~190mm / 3)
      display: 'flex',
      flexDirection: 'column',
      pageBreakInside: 'avoid',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'baseline',
        marginBottom: '2mm',
        flexShrink: 0
      }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: '600' }}>Wild Octave Organics</span>
          <span style={{ fontSize: '11px', marginLeft: '10px', color: '#555' }}>Timesheet</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: '700', fontSize: '16px' }}>{employeeName}</span>
          <span style={{ marginLeft: '14px', fontSize: '12px' }}>{MONTHS[month]} {year}</span>
        </div>
      </div>

      {/* Timesheet Grid - fills remaining space */}
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        fontSize: '9px',
        flex: 1,
        tableLayout: 'fixed'
      }}>
        <thead>
          <tr>
            <th style={{ 
              border: '1px solid black', 
              padding: '2px 4px',
              width: '38px',
              fontWeight: '600',
              backgroundColor: 'white',
              fontSize: '9px'
            }}>Day</th>
            {days.map((d) => (
              <th 
                key={d.day}
                style={{ 
                  border: '1px solid black', 
                  padding: '1px',
                  textAlign: 'center',
                  fontWeight: d.isWeekend ? 'bold' : 'normal',
                  backgroundColor: 'white',
                  fontSize: '9px',
                  lineHeight: '1.1'
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
          <tr style={{ height: '25%' }}>
            <td style={{ border: '1px solid black', padding: '2px 4px', fontWeight: '600', backgroundColor: 'white', fontSize: '9px' }}>Start</td>
            {days.map((d) => (
              <td key={`start-${d.day}`} style={{ border: '1px solid black', backgroundColor: 'white' }}></td>
            ))}
          </tr>
          {/* End Time Row */}
          <tr style={{ height: '25%' }}>
            <td style={{ border: '1px solid black', padding: '2px 4px', fontWeight: '600', backgroundColor: 'white', fontSize: '9px' }}>End</td>
            {days.map((d) => (
              <td key={`end-${d.day}`} style={{ border: '1px solid black', backgroundColor: 'white' }}></td>
            ))}
          </tr>
          {/* Break Row */}
          <tr style={{ height: '25%' }}>
            <td style={{ border: '1px solid black', padding: '2px 4px', fontWeight: '600', backgroundColor: 'white', fontSize: '9px' }}>Break</td>
            {days.map((d) => (
              <td key={`brk-${d.day}`} style={{ border: '1px solid black', backgroundColor: 'white', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ 
                  width: '10px', 
                  height: '10px', 
                  border: '1.5px solid black',
                  margin: '0 auto',
                  backgroundColor: 'white'
                }}></div>
              </td>
            ))}
          </tr>
          {/* Hours Row */}
          <tr style={{ height: '25%' }}>
            <td style={{ border: '1px solid black', padding: '2px 4px', fontWeight: '600', backgroundColor: 'white', fontSize: '9px' }}>Hours</td>
            {days.map((d) => (
              <td key={`hrs-${d.day}`} style={{ border: '1px solid black', backgroundColor: 'white' }}></td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* Footer - signatures */}
      <div style={{ 
        marginTop: '2mm',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '28px',
        fontSize: '10px',
        flexShrink: 0
      }}>
        <div>
          <span>Employee:</span>
          <span style={{ 
            display: 'inline-block', 
            width: '90px', 
            borderBottom: '1px solid black',
            marginLeft: '4px'
          }}></span>
        </div>
        <div>
          <span>Manager:</span>
          <span style={{ 
            display: 'inline-block', 
            width: '90px', 
            borderBottom: '1px solid black',
            marginLeft: '4px'
          }}></span>
        </div>
      </div>
    </div>
  );
}

export default function TimesheetsPage() {
  const today = new Date();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [customEmployee, setCustomEmployee] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [printMode, setPrintMode] = useState<'single' | 'all'>('single');

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

  const handlePrintSingle = () => {
    setPrintMode('single');
    setTimeout(() => window.print(), 100);
  };

  const handlePrintAll = () => {
    setPrintMode('all');
    setTimeout(() => window.print(), 100);
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

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(selectedYear, selectedMonth, i + 1);
    return {
      day: i + 1,
      dayName: DAY_ABBREV[date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    };
  });

  // Group staff into pages of 3
  const staffPages: Staff[][] = [];
  for (let i = 0; i < staff.length; i += 3) {
    staffPages.push(staff.slice(i, i + 3));
  }

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 5mm;
          }
          
          body * {
            visibility: hidden;
          }
          
          #printable-area,
          #printable-area * {
            visibility: visible;
          }
          
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
          }
          
          #printable-area,
          #printable-area * {
            background: white !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: black !important;
          }
          
          .print-page {
            height: 190mm;
            width: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-after: always;
          }
          
          .print-page:last-child {
            page-break-after: auto;
          }
          
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <DashboardLayout>
        {/* Screen Controls */}
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6 no-print">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-emerald-600" />
            Employee Timesheets
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button
                  onClick={() => changeMonth(1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print All Button */}
            <div className="flex items-end">
              <button
                onClick={handlePrintAll}
                disabled={staff.length === 0}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Users className="w-5 h-5" />
                Print All Staff ({staff.length})
              </button>
            </div>

            {/* Employee Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Or Print Individual
              </label>
              {loading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                      placeholder="Enter name..."
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  )}
                </>
              )}
            </div>

            {/* Print Single Button */}
            <div className="flex items-end">
              <button
                onClick={handlePrintSingle}
                disabled={!employeeName}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Printer className="w-5 h-5" />
                Print Single
              </button>
            </div>
          </div>
        </div>

        {/* Printable Area */}
        <div id="printable-area" style={{ backgroundColor: 'white' }}>
          {printMode === 'single' ? (
            <div className="print-page" style={{ padding: '0 4mm' }}>
              <TimesheetCard 
                employeeName={employeeName || '_______________'} 
                month={selectedMonth} 
                year={selectedYear}
                days={days}
              />
              <div style={{ flex: 1 }}></div>
              <div style={{ flex: 1 }}></div>
            </div>
          ) : (
            staffPages.map((pageStaff, pageIndex) => (
              <div 
                key={pageIndex} 
                className="print-page"
                style={{ padding: '0 4mm' }}
              >
                {pageStaff.map((staffMember, idx) => (
                  <TimesheetCard 
                    key={staffMember.id}
                    employeeName={staffMember.name} 
                    month={selectedMonth} 
                    year={selectedYear}
                    days={days}
                  />
                ))}
                {/* Fill remaining slots if less than 3 */}
                {pageStaff.length < 3 && Array.from({ length: 3 - pageStaff.length }).map((_, idx) => (
                  <div key={`empty-${idx}`} style={{ height: '63mm' }}></div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Preview */}
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4 no-print">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Preview</h3>
          <div className="border rounded-lg p-3 bg-gray-50 overflow-auto">
            <TimesheetCard 
              employeeName={employeeName || 'Employee Name'} 
              month={selectedMonth} 
              year={selectedYear}
              days={days}
            />
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
