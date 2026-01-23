import puppeteer from 'puppeteer';

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper function to get role color
const getRoleColor = (role: string, isBackupBarista: boolean = false) => {
  if (isBackupBarista) return 'bg-purple-100 border-purple-200';
  switch (role?.toLowerCase()) {
    case 'manager': return 'bg-green-100 border-green-200';
    case 'open': return 'bg-cyan-100 border-cyan-200';
    case 'open & close': return 'bg-yellow-100 border-yellow-200';
    case 'close': return 'bg-red-100 border-red-200';
    case 'barista': return 'bg-blue-100 border-blue-200';
    case 'kitchen':
    case 'kitchen staff': return 'bg-orange-100 border-orange-200';
    case 'counter/roam': return 'bg-pink-100 border-pink-200';
    case 'junior': return 'bg-gray-100 border-gray-200';
    case 'admin':
    case 'check-in/admin': return 'bg-indigo-100 border-indigo-200';
    default: return 'bg-gray-100 border-gray-200';
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

// Generate HTML roster template
function generateRosterHTML(roster: Roster, staff: Staff[], weekStartDate: Date): string {
  // Get active staff who have shifts this week
  const activeStaff = staff
    .filter(s => s.isActive)
    .filter(s => roster.shifts.some(shift => shift.staffId === s.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Separate into seniors and juniors
  const seniorStaff = activeStaff.filter(s => !s.role.toLowerCase().includes('junior'));
  const juniorStaff = activeStaff.filter(s => s.role.toLowerCase().includes('junior'));

  // Get shifts for a specific staff member and day
  const getShiftsForStaffAndDay = (staffId: string, dayIndex: number) => {
    const targetDayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1;
    return roster.shifts.filter(s => s.staffId === staffId && s.dayOfWeek === targetDayOfWeek);
  };

  // Render staff table
  const renderStaffTable = (staffList: Staff[], sectionTitle?: string) => {
    return `
      <div class="mb-8">
        ${sectionTitle ? `<h2 class="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-300">${sectionTitle}</h2>` : ''}
        <div class="border border-gray-300 rounded-lg overflow-hidden">
          <div class="grid grid-cols-8 bg-gray-100">
            <div class="p-3 font-bold text-gray-900 border-r border-gray-300">Staff</div>
            ${DAYS.map((day, index) => `
              <div class="p-3 text-center border-r border-gray-300 last:border-r-0">
                <div class="font-bold text-gray-900">${day}</div>
                <div class="text-sm text-gray-900">${formatDate(weekStartDate, index)}</div>
              </div>
            `).join('')}
          </div>
          ${staffList.map(person => {
            const isJunior = person.role.toLowerCase().includes('junior');
            return `
              <div class="grid grid-cols-8 border-t border-gray-200 ${isJunior ? 'bg-blue-50' : ''}">
                <div class="p-3 border-r border-gray-300 ${isJunior ? 'bg-blue-100' : 'bg-gray-50'}">
                  <div class="font-semibold ${isJunior ? 'text-blue-900' : 'text-gray-900'}">${person.name}</div>
                  <div class="text-sm ${isJunior ? 'text-blue-700' : 'text-gray-900'}">${person.role}</div>
                </div>
                ${DAYS.map((day, dayIndex) => {
                  const shifts = getShiftsForStaffAndDay(person.id, dayIndex);
                  return `
                    <div class="p-2 border-r border-gray-300 last:border-r-0 min-h-[80px]">
                      ${shifts.map(shift => `
                        <div class="${getRoleColor(shift.role || person.role, shift.isBackupBarista)} rounded p-2 mb-1 last:mb-0 border">
                          <div class="font-semibold text-sm text-gray-900">${shift.startTime}-${shift.endTime}</div>
                          ${shift.role && shift.role !== person.role ? `<div class="text-xs text-gray-900 capitalize">${shift.role}</div>` : ''}
                          ${shift.isBackupBarista ? '<div class="text-xs text-purple-600 font-medium">Backup Barista</div>' : ''}
                          ${shift.notes ? `<div class="text-xs text-gray-900 mt-1">${shift.notes}</div>` : ''}
                        </div>
                      `).join('')}
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  const weekFormatted = weekStartDate.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `
    <div class="bg-white p-8 min-h-screen">
      <div class="text-center mb-12">
        <div class="flex items-center justify-center mb-6">
          <div class="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mr-4">
            <span class="text-white font-bold text-2xl">★</span>
          </div>
          <h1 class="text-5xl font-bold text-gray-900">Wild Octave Organics Roster</h1>
        </div>
        <div class="text-2xl text-gray-900 mb-6">Week of ${weekFormatted}</div>
      </div>

      ${seniorStaff.length > 0 ? renderStaffTable(seniorStaff, 'Seniors') : ''}
      ${juniorStaff.length > 0 ? renderStaffTable(juniorStaff, 'Juniors') : ''}

      <div class="mt-8 text-center text-sm text-gray-900">
        Generated on ${new Date().toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </div>
  `;
}

export async function generateRosterImage(
  roster: Roster,
  staff: Staff[],
  weekStartDate: Date
): Promise<Buffer> {
  let browser = null;

  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Set viewport to ensure consistent rendering
    await page.setViewport({
      width: 1400,
      height: 1000,
      deviceScaleFactor: 2, // High DPI for better quality
    });

    // Generate HTML content
    const htmlContent = generateRosterHTML(roster, staff, weekStartDate);

    // Create full HTML document with styles
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      -webkit-font-smoothing: antialiased;
      background: white;
    }

    /* Tailwind-like utility classes used in RosterPreview */
    .bg-white { background-color: white; }
    .p-8 { padding: 2rem; }
    .min-h-screen { min-height: 100vh; }
    .text-center { text-align: center; }
    .mb-12 { margin-bottom: 3rem; }
    .mb-8 { margin-bottom: 2rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mr-4 { margin-right: 1rem; }
    .mr-3 { margin-right: 0.75rem; }
    .mr-2 { margin-right: 0.5rem; }
    .mt-8 { margin-top: 2rem; }
    .mt-6 { margin-top: 1.5rem; }
    .mt-1 { margin-top: 0.25rem; }
    .pb-2 { padding-bottom: 0.5rem; }
    .p-3 { padding: 0.75rem; }
    .p-2 { padding: 0.5rem; }
    .text-5xl { font-size: 3rem; line-height: 1; }
    .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
    .text-2xl { font-size: 1.5rem; line-height: 2rem; }
    .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    .text-xs { font-size: 0.75rem; line-height: 1rem; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .text-gray-900 { color: rgb(17, 24, 39); }
    .text-gray-700 { color: rgb(55, 65, 81); }
    .text-gray-600 { color: rgb(75, 85, 99); }
    .text-gray-500 { color: rgb(107, 114, 128); }
    .text-white { color: white; }
    .text-purple-600 { color: rgb(147, 51, 234); }
    .text-blue-900 { color: rgb(30, 58, 138); }
    .text-blue-700 { color: rgb(29, 78, 216); }

    /* Background colors */
    .bg-purple-600 { background-color: rgb(147, 51, 234); }
    .bg-gray-100 { background-color: rgb(243, 244, 246); }
    .bg-gray-50 { background-color: rgb(249, 250, 251); }
    .bg-green-100 { background-color: rgb(220, 252, 231); }
    .bg-cyan-100 { background-color: rgb(207, 250, 254); }
    .bg-yellow-100 { background-color: rgb(254, 249, 195); }
    .bg-red-100 { background-color: rgb(254, 226, 226); }
    .bg-blue-50 { background-color: rgb(239, 246, 255); }
    .bg-blue-100 { background-color: rgb(219, 234, 254); }
    .bg-purple-100 { background-color: rgb(243, 232, 255); }
    .bg-orange-100 { background-color: rgb(255, 237, 213); }
    .bg-pink-100 { background-color: rgb(252, 231, 243); }
    .bg-indigo-100 { background-color: rgb(224, 231, 255); }

    /* Border colors */
    .border { border-width: 1px; }
    .border-t { border-top-width: 1px; }
    .border-r { border-right-width: 1px; }
    .border-b-2 { border-bottom-width: 2px; }
    .border-gray-300 { border-color: rgb(209, 213, 219); }
    .border-gray-200 { border-color: rgb(229, 231, 235); }
    .border-green-200 { border-color: rgb(187, 247, 208); }
    .border-cyan-200 { border-color: rgb(165, 243, 252); }
    .border-yellow-200 { border-color: rgb(254, 240, 138); }
    .border-red-200 { border-color: rgb(254, 202, 202); }
    .border-blue-200 { border-color: rgb(191, 219, 254); }
    .border-purple-200 { border-color: rgb(233, 213, 255); }
    .border-orange-200 { border-color: rgb(254, 215, 170); }
    .border-pink-200 { border-color: rgb(251, 207, 232); }
    .border-indigo-200 { border-color: rgb(199, 210, 254); }

    /* Layout */
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .grid { display: grid; }
    .grid-cols-8 { grid-template-columns: repeat(8, minmax(0, 1fr)); }
    .grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .gap-4 { gap: 1rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded { border-radius: 0.25rem; }
    .rounded-full { border-radius: 9999px; }
    .overflow-hidden { overflow: hidden; }
    .w-12 { width: 3rem; }
    .h-12 { height: 3rem; }
    .w-8 { width: 2rem; }
    .h-8 { height: 2rem; }
    .w-4 { width: 1rem; }
    .h-4 { height: 1rem; }
    .last\\:border-r-0:last-child { border-right-width: 0; }
    .last\\:mb-0:last-child { margin-bottom: 0; }
    .capitalize { text-transform: capitalize; }
    .min-h-\\[80px\\] { min-height: 80px; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
    `;

    // Set HTML content
    await page.setContent(fullHtml, {
      waitUntil: 'networkidle0',
    });

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
    });

    return screenshot as Buffer;
  } catch (error) {
    console.error('Error generating roster image:', error);
    throw new Error('Failed to generate roster image');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
