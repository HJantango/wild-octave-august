'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';

const STAFF_NAMES = [
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
  '', // Blank line for new staff
  '', // Blank line for new staff
  '', // Blank line for new staff
];

const MONTHS_2026 = [
  { name: 'JANUARY', days: 31 },
  { name: 'FEBRUARY', days: 28 },
  { name: 'MARCH', days: 31 },
  { name: 'APRIL', days: 30 },
  { name: 'MAY', days: 31 },
  { name: 'JUNE', days: 30 },
  { name: 'JULY', days: 31 },
  { name: 'AUGUST', days: 31 },
  { name: 'SEPTEMBER', days: 30 },
  { name: 'OCTOBER', days: 31 },
  { name: 'NOVEMBER', days: 30 },
  { name: 'DECEMBER', days: 31 },
];

export default function StaffLeavePage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Screen-only controls - completely hidden when printing */}
      <div className="print:hidden">
        <DashboardLayout>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Staff Leave 2026</h1>
                <p className="text-gray-600">Print these charts for staff to mark their leave on the wall</p>
              </div>
              <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                🖨️ Print All Months
              </Button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">How to Use:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Print all 12 months (one page per month)</li>
                <li>• Hang on the wall near the roster</li>
                <li>• Staff use a marker/texta to block out their leave dates</li>
                <li>• Blank lines at the bottom are for new or temporary staff</li>
              </ul>
            </div>

            <div className="space-y-8">
              {MONTHS_2026.map((month) => (
                <div key={month.name} className="border rounded-lg p-4">
                  <h2 className="text-xl font-bold mb-4">{month.name} 2026</h2>
                  <div className="text-sm text-gray-600">
                    Preview - Click "Print All Months" to print
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DashboardLayout>
      </div>

      {/* Print-only content - completely separate from screen layout */}
      <div className="hidden print:block">
        {MONTHS_2026.map((month, monthIndex) => (
          <div key={month.name} className="print-page">
            {/* Month heading */}
            <h1 className="month-title">
              {month.name} 2026 LEAVE CHART
            </h1>

            {/* Leave grid */}
            <table className="leave-table">
              {/* Header row with day numbers */}
              <thead>
                <tr>
                  <th className="name-header">Staff Name</th>
                  {Array.from({ length: month.days }, (_, i) => (
                    <th key={i + 1} className="day-header">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Staff rows */}
              <tbody>
                {STAFF_NAMES.map((name, staffIndex) => (
                  <tr key={staffIndex} className="staff-row">
                    <td className="name-cell">
                      {name || '\u00A0'}
                    </td>
                    {Array.from({ length: month.days }, (_, dayIndex) => (
                      <td key={dayIndex} className="day-cell"></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          /* Page setup */
          @page {
            size: A4 landscape;
            margin: 0.5cm;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Hide EVERYTHING except our print content */
          body > *:not(.hidden) {
            display: none !important;
          }

          /* Show only print content */
          .hidden.print\\:block {
            display: block !important;
          }

          /* Each month on separate page */
          .print-page {
            page-break-after: always;
            break-after: page;
            width: 100%;
            height: 100%;
            background: white !important;
            padding: 0.5cm;
          }

          /* Last page no break */
          .print-page:last-child {
            page-break-after: auto;
          }

          /* Month title */
          .month-title {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            margin: 0 0 0.5cm 0;
            color: black;
            background: white !important;
          }

          /* Table styling */
          .leave-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            background: white !important;
          }

          /* Header cells */
          .name-header {
            width: 90px;
            border: 2px solid black;
            padding: 4px;
            text-align: left;
            font-weight: bold;
            font-size: 11pt;
            background: white !important;
          }

          .day-header {
            border: 2px solid black;
            padding: 2px;
            text-align: center;
            font-weight: bold;
            font-size: 9pt;
            background: white !important;
          }

          /* Staff rows */
          .staff-row {
            height: 30px;
          }

          .name-cell {
            border: 2px solid black;
            padding: 4px;
            font-size: 11pt;
            font-weight: 500;
            background: white !important;
            color: black;
          }

          .day-cell {
            border: 2px solid black;
            padding: 0;
            background: white !important;
          }
        }

        /* Screen styles */
        @media screen {
          .hidden {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
