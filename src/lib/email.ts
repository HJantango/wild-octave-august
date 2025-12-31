import nodemailer from 'nodemailer';
import { render } from '@react-email/components';
import RosterSummaryEmail from '@/emails/roster-summary';

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  // For development, you can use a service like Ethereal Email (https://ethereal.email/)
  // For production, configure with your actual email service (Gmail, SendGrid, etc.)
  
  if (process.env.NODE_ENV === 'development') {
    // Development mode - log emails instead of sending
    return nodemailer.createTransporter({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });
  }

  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

interface ShiftData {
  day: string;
  date: string;
  startTime: string;
  endTime: string;
  role?: string;
  isBackupBarista?: boolean;
  notes?: string;
}

interface StaffMember {
  id: string;
  name: string;
  email?: string;
  shifts: ShiftData[];
  totalHours: number;
}

export async function sendRosterEmails(
  weekStartDate: string,
  staffMembers: StaffMember[],
  rosterPdfBuffer?: Buffer
) {
  const transporter = createTransporter();
  const results = [];

  for (const staff of staffMembers) {
    if (!staff.email) {
      console.log(`No email address for ${staff.name}, skipping...`);
      continue;
    }

    try {
      // Generate HTML email content
      const emailHtml = render(
        RosterSummaryEmail({
          weekStartDate,
          staffName: staff.name,
          shifts: staff.shifts,
          totalHours: staff.totalHours,
        })
      );

      // Email options
      const mailOptions = {
        from: process.env.SMTP_FROM || '"Wild Octave" <roster@wildoctave.com>',
        to: staff.email,
        subject: `Your Wild Octave Roster - Week of ${new Date(weekStartDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}`,
        html: emailHtml,
        attachments: rosterPdfBuffer ? [{
          filename: `wild-octave-roster-${weekStartDate}.pdf`,
          content: rosterPdfBuffer,
          contentType: 'application/pdf'
        }] : undefined
      };

      if (process.env.NODE_ENV === 'development') {
        // In development, log the email instead of sending
        console.log('📧 Development Email Log:');
        console.log(`To: ${staff.email}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Staff: ${staff.name}`);
        console.log(`Shifts: ${staff.shifts.length}`);
        console.log(`Total Hours: ${staff.totalHours.toFixed(1)}`);
        console.log('---');
        
        results.push({
          staff: staff.name,
          email: staff.email,
          success: true,
          messageId: 'dev-mode'
        });
      } else {
        // Send actual email in production
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${staff.name}: ${info.messageId}`);
        
        results.push({
          staff: staff.name,
          email: staff.email,
          success: true,
          messageId: info.messageId
        });
      }
    } catch (error) {
      console.error(`Failed to send email to ${staff.name}:`, error);
      results.push({
        staff: staff.name,
        email: staff.email,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

export async function generateRosterPDF(rosterData: any): Promise<Buffer> {
  try {
    const puppeteer = (await import('puppeteer')).default;
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Generate the HTML content for the roster
    const htmlContent = generateRosterHTML(rosterData);
    
    // Set content and generate PDF
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
      printBackground: true,
    });
    
    await browser.close();
    
    console.log('📄 PDF generated successfully for roster:', rosterData.id);
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating roster PDF:', error);
    throw new Error('Failed to generate roster PDF');
  }
}

function generateRosterHTML(rosterData: any): string {
  const { roster, staff, weekStartDate } = rosterData;
  const companyName = 'Wild Octave'; // You might want to get this from settings
  
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Helper function to get role color
  const getRoleColor = (role: string, isBackupBarista: boolean = false): string => {
    if (isBackupBarista) return 'background-color: #f3e8ff; border-color: #e9d5ff;';
    
    switch (role?.toLowerCase()) {
      case 'manager': return 'background-color: #f0fdf4; border-color: #bbf7d0;';
      case 'close': return 'background-color: #fef2f2; border-color: #fecaca;';
      case 'barista': return 'background-color: #eff6ff; border-color: #bfdbfe;';
      case 'kitchen':
      case 'kitchen staff': return 'background-color: #fff7ed; border-color: #fed7aa;';
      case 'counter/roam': return 'background-color: #fdf2f8; border-color: #fbcfe8;';
      case 'junior': return 'background-color: #fefce8; border-color: #fde047;';
      case 'admin':
      case 'check-in/admin': return 'background-color: #eef2ff; border-color: #c7d2fe;';
      default: return 'background-color: #f9fafb; border-color: #e5e7eb;';
    }
  };
  
  // Get shifts for a specific staff member and day
  const getShiftsForStaffAndDay = (staffId: string, dayIndex: number) => {
    if (!roster) return [];
    const targetDayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1;
    return roster.shifts.filter((s: any) => s.staffId === staffId && s.dayOfWeek === targetDayOfWeek);
  };
  
  // Format date
  const formatDate = (date: Date, dayOffset: number): string => {
    const targetDate = new Date(date);
    targetDate.setDate(date.getDate() + dayOffset);
    return targetDate.toLocaleDateString('en-AU', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };
  
  // Get active staff who have shifts this week
  const activeStaff = staff
    .filter((s: any) => s.isActive)
    .filter((s: any) => {
      if (!roster) return false;
      return roster.shifts.some((shift: any) => shift.staffId === s.id);
    })
    .sort((a: any, b: any) => {
      const aIsJunior = a.role.toLowerCase().includes('junior');
      const bIsJunior = b.role.toLowerCase().includes('junior');
      if (aIsJunior !== bIsJunior) {
        return aIsJunior ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${companyName} Roster</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: white;
          color: #111827;
          padding: 32px;
        }
        .header { text-align: center; margin-bottom: 32px; }
        .header h1 { 
          font-size: 24px; 
          font-weight: bold; 
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo { 
          width: 32px; 
          height: 32px; 
          background: #7c3aed; 
          border-radius: 50%; 
          display: inline-flex; 
          align-items: center; 
          justify-content: center; 
          margin-right: 12px;
          color: white;
          font-weight: bold;
          font-size: 16px;
        }
        .week-info { font-size: 18px; margin-bottom: 24px; }
        .roster-table { 
          width: 100%; 
          border-collapse: collapse; 
          border: 1px solid #d1d5db;
          border-radius: 8px;
          overflow: hidden;
        }
        .header-row { background-color: #f9fafb; }
        .header-cell { 
          padding: 12px; 
          font-weight: bold; 
          text-align: center;
          border-right: 1px solid #d1d5db;
          border-bottom: 1px solid #d1d5db;
        }
        .staff-cell { 
          padding: 12px; 
          background-color: #f9fafb;
          border-right: 1px solid #d1d5db;
          border-bottom: 1px solid #d1d5db;
          min-width: 120px;
        }
        .day-cell { 
          padding: 8px; 
          border-right: 1px solid #d1d5db;
          border-bottom: 1px solid #d1d5db;
          min-height: 80px;
          vertical-align: top;
        }
        .shift { 
          border-radius: 4px; 
          padding: 8px; 
          margin-bottom: 4px; 
          border: 1px solid;
          font-size: 12px;
        }
        .shift-time { font-weight: 600; margin-bottom: 2px; }
        .shift-role { font-size: 10px; text-transform: capitalize; }
        .backup-barista { font-size: 10px; color: #7c3aed; font-weight: 500; }
        .shift-notes { font-size: 10px; margin-top: 4px; }
        .staff-name { font-weight: 600; margin-bottom: 2px; }
        .staff-role { font-size: 12px; color: #6b7280; }
        .legend { 
          margin-top: 24px; 
          display: grid; 
          grid-template-columns: repeat(4, 1fr); 
          gap: 16px; 
          font-size: 12px;
        }
        .legend-item { display: flex; align-items: center; }
        .legend-color { 
          width: 16px; 
          height: 16px; 
          border-radius: 4px; 
          margin-right: 8px; 
          border: 1px solid;
        }
        .footer { 
          margin-top: 32px; 
          text-align: center; 
          font-size: 12px; 
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>
          <div class="logo">★</div>
          ${companyName} Roster
        </h1>
        <div class="week-info">
          Week of ${new Date(weekStartDate).toLocaleDateString('en-AU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })}
        </div>
      </div>

      <table class="roster-table">
        <tr class="header-row">
          <th class="header-cell">Staff</th>
          ${DAYS.map((day, index) => `
            <th class="header-cell">
              <div>${day}</div>
              <div style="font-weight: normal; font-size: 12px;">${formatDate(new Date(weekStartDate), index)}</div>
            </th>
          `).join('')}
        </tr>
        
        ${activeStaff.map((person: any) => `
          <tr>
            <td class="staff-cell">
              <div class="staff-name">${person.name}</div>
              <div class="staff-role">${person.role}</div>
            </td>
            ${DAYS.map((day, dayIndex) => {
              const shifts = getShiftsForStaffAndDay(person.id, dayIndex);
              return `
                <td class="day-cell">
                  ${shifts.map((shift: any) => `
                    <div class="shift" style="${getRoleColor(shift.role || person.role, shift.isBackupBarista)}">
                      <div class="shift-time">${shift.startTime}-${shift.endTime}</div>
                      ${shift.role && shift.role !== person.role ? `
                        <div class="shift-role">${shift.role}</div>
                      ` : ''}
                      ${shift.isBackupBarista ? `
                        <div class="backup-barista">Backup Barista</div>
                      ` : ''}
                      ${shift.notes ? `
                        <div class="shift-notes">${shift.notes}</div>
                      ` : ''}
                    </div>
                  `).join('')}
                </td>
              `;
            }).join('')}
          </tr>
        `).join('')}
      </table>

      <div class="legend">
        <div class="legend-item">
          <div class="legend-color" style="background-color: #f0fdf4; border-color: #bbf7d0;"></div>
          <span>Manager</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #eff6ff; border-color: #bfdbfe;"></div>
          <span>Barista</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #f3e8ff; border-color: #e9d5ff;"></div>
          <span>Backup Barista</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #fefce8; border-color: #fde047;"></div>
          <span>Junior</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #fff7ed; border-color: #fed7aa;"></div>
          <span>Kitchen</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #fdf2f8; border-color: #fbcfe8;"></div>
          <span>Counter/Roam</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #fef2f2; border-color: #fecaca;"></div>
          <span>Close</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #eef2ff; border-color: #c7d2fe;"></div>
          <span>Admin</span>
        </div>
      </div>

      <div class="footer">
        Generated on ${new Date().toLocaleDateString('en-AU', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </body>
    </html>
  `;
}

// Helper function to calculate total hours for a staff member's shifts
export function calculateTotalHours(shifts: any[]): number {
  return shifts.reduce((total, shift) => {
    const startTime = new Date(`2000-01-01T${shift.startTime}`);
    const endTime = new Date(`2000-01-01T${shift.endTime}`);
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const workedHours = hours - (shift.breakMinutes || 30) / 60;
    return total + Math.max(0, workedHours);
  }, 0);
}