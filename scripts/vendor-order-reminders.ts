/**
 * Wild Octave Vendor Order Reminders
 * 
 * Checks for vendor orders due today with upcoming deadlines and formats
 * a WhatsApp-friendly reminder message.
 * 
 * Usage:
 *   npx tsx scripts/vendor-order-reminders.ts              # Default: 2 hours ahead
 *   npx tsx scripts/vendor-order-reminders.ts --hours 3    # 3 hours ahead
 *   npx tsx scripts/vendor-order-reminders.ts --all        # All orders due today
 *   npx tsx scripts/vendor-order-reminders.ts --json       # Output raw JSON
 *   
 * Exit codes:
 *   0 - Success (reminders found and output)
 *   1 - Error
 *   2 - No reminders to send
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from multiple possible locations
const envPaths = [
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env'),
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), '.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.error(`📁 Loaded env from: ${envPath}`);
    break;
  }
}

// Check for required env var
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set.');
  console.error('   For local dev: Create .env.local with DATABASE_URL=postgresql://...');
  console.error('   For Railway: DATABASE_URL is auto-configured.');
  process.exit(1);
}

const prisma = new PrismaClient();

interface VendorSchedule {
  id: string;
  vendorId: string;
  vendor: { id: string; name: string };
  orderDay: string;
  deliveryDay: string | null;
  frequency: string;
  weekOffset: number;
  leadTimeDays: number;
  isActive: boolean;
  orderDeadline: string | null;
  notes: string | null;
}

interface Reminder {
  vendorName: string;
  orderDeadline: string | null;
  timeRemaining: string | null;
  minutesUntil: number | null;
  deliveryDay: string | null;
  notes: string | null;
  isOverdue: boolean;
  priority: 'urgent' | 'soon' | 'today';
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDeadlineTime(deadline: string): { hour: number; minute: number } | null {
  const match = deadline.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  
  let hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  
  return { hour, minute };
}

function getMinutesUntilDeadline(deadline: string, nowAEDT: Date): number {
  const parsed = parseDeadlineTime(deadline);
  if (!parsed) return Infinity;
  
  const deadlineDate = new Date(nowAEDT);
  deadlineDate.setHours(parsed.hour, parsed.minute, 0, 0);
  
  return Math.floor((deadlineDate.getTime() - nowAEDT.getTime()) / (1000 * 60));
}

function formatTimeRemaining(minutes: number): string {
  if (minutes < 0) {
    const over = Math.abs(minutes);
    if (over < 60) return `${over}min overdue`;
    const hours = Math.floor(over / 60);
    return `${hours}h overdue`;
  }
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getPriority(minutes: number | null, isOverdue: boolean): Reminder['priority'] {
  if (isOverdue) return 'urgent';
  if (minutes === null) return 'today';
  if (minutes <= 30) return 'urgent';
  if (minutes <= 120) return 'soon';
  return 'today';
}

async function getReminders(hoursAhead: number, includeAll: boolean): Promise<{
  reminders: Reminder[];
  nowAEDT: Date;
  todayDayName: string;
}> {
  // Get current time in AEDT (UTC+11)
  const now = new Date();
  const aedtOffset = 11 * 60 * 60 * 1000;
  const nowAEDT = new Date(now.getTime() + aedtOffset);
  const todayDayName = DAYS_OF_WEEK[nowAEDT.getDay()];
  
  console.error(`🕐 Checking orders for ${todayDayName} (${nowAEDT.toLocaleTimeString('en-AU', { timeZone: 'UTC' })} AEDT)`);
  
  // Fetch active schedules for today
  const schedules = await prisma.vendorOrderSchedule.findMany({
    where: {
      isActive: true,
      orderDay: todayDayName,
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  
  console.error(`   Found ${schedules.length} schedules for today`);
  
  const reminders: Reminder[] = [];
  
  for (const schedule of schedules) {
    let minutesUntil: number | null = null;
    let isOverdue = false;
    
    if (schedule.orderDeadline) {
      minutesUntil = getMinutesUntilDeadline(schedule.orderDeadline, nowAEDT);
      isOverdue = minutesUntil < 0;
      
      // Skip if deadline too far ahead (unless includeAll)
      if (!includeAll && !isOverdue && minutesUntil > hoursAhead * 60) {
        console.error(`   Skipping ${schedule.vendor.name} - deadline in ${formatTimeRemaining(minutesUntil)}`);
        continue;
      }
    } else if (!includeAll) {
      // Skip orders with no deadline unless includeAll
      console.error(`   Skipping ${schedule.vendor.name} - no deadline set`);
      continue;
    }
    
    reminders.push({
      vendorName: schedule.vendor.name,
      orderDeadline: schedule.orderDeadline,
      timeRemaining: minutesUntil !== null ? formatTimeRemaining(minutesUntil) : null,
      minutesUntil,
      deliveryDay: schedule.deliveryDay,
      notes: schedule.notes,
      isOverdue,
      priority: getPriority(minutesUntil, isOverdue),
    });
  }
  
  // Sort by urgency
  reminders.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    const aMin = a.minutesUntil ?? Infinity;
    const bMin = b.minutesUntil ?? Infinity;
    return aMin - bMin;
  });
  
  return { reminders, nowAEDT, todayDayName };
}

function formatWhatsAppMessage(reminders: Reminder[], nowAEDT: Date, todayDayName: string): string {
  const lines: string[] = [];
  
  // Header with urgency indicator
  const hasUrgent = reminders.some(r => r.priority === 'urgent');
  const hasSoon = reminders.some(r => r.priority === 'soon');
  
  if (hasUrgent) {
    lines.push('🚨 *VENDOR ORDER REMINDER*');
  } else if (hasSoon) {
    lines.push('⏰ *Vendor Order Reminder*');
  } else {
    lines.push('📋 *Vendor Order Reminder*');
  }
  
  const timeStr = nowAEDT.toLocaleTimeString('en-AU', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC' 
  });
  lines.push(`${todayDayName} ${timeStr} AEDT`);
  lines.push('');
  
  // Overdue orders first
  const overdue = reminders.filter(r => r.isOverdue);
  if (overdue.length > 0) {
    lines.push('❌ *OVERDUE*');
    for (const r of overdue) {
      lines.push(`• *${r.vendorName}* — deadline was ${r.orderDeadline}`);
      if (r.notes) lines.push(`  _${r.notes}_`);
    }
    lines.push('');
  }
  
  // Urgent (within 30 min)
  const urgent = reminders.filter(r => r.priority === 'urgent' && !r.isOverdue);
  if (urgent.length > 0) {
    lines.push('🔴 *ORDER NOW*');
    for (const r of urgent) {
      lines.push(`• *${r.vendorName}* — ${r.timeRemaining} left (${r.orderDeadline})`);
      if (r.deliveryDay) lines.push(`  📦 Delivery: ${r.deliveryDay}`);
      if (r.notes) lines.push(`  _${r.notes}_`);
    }
    lines.push('');
  }
  
  // Soon (within 2 hours)
  const soon = reminders.filter(r => r.priority === 'soon');
  if (soon.length > 0) {
    lines.push('🟡 *Coming Up*');
    for (const r of soon) {
      lines.push(`• *${r.vendorName}* — ${r.timeRemaining} (${r.orderDeadline})`);
      if (r.deliveryDay) lines.push(`  📦 Delivery: ${r.deliveryDay}`);
      if (r.notes) lines.push(`  _${r.notes}_`);
    }
    lines.push('');
  }
  
  // Today (no specific deadline or later)
  const today = reminders.filter(r => r.priority === 'today');
  if (today.length > 0) {
    lines.push('📋 *Also Due Today*');
    for (const r of today) {
      if (r.orderDeadline) {
        lines.push(`• *${r.vendorName}* — ${r.timeRemaining} (${r.orderDeadline})`);
      } else {
        lines.push(`• *${r.vendorName}* — no deadline`);
      }
      if (r.deliveryDay) lines.push(`  📦 Delivery: ${r.deliveryDay}`);
      if (r.notes) lines.push(`  _${r.notes}_`);
    }
  }
  
  return lines.join('\n').trim();
}

async function main() {
  const args = process.argv.slice(2);
  const hoursIdx = args.indexOf('--hours');
  const hoursAhead = hoursIdx !== -1 ? parseInt(args[hoursIdx + 1]) : 2;
  const includeAll = args.includes('--all');
  const outputJson = args.includes('--json');
  
  try {
    const { reminders, nowAEDT, todayDayName } = await getReminders(hoursAhead, includeAll);
    
    if (reminders.length === 0) {
      console.error('✅ No vendor orders need attention right now.');
      process.exit(2);
    }
    
    console.error(`📋 ${reminders.length} order reminder(s) to send\n`);
    
    if (outputJson) {
      console.log(JSON.stringify({
        timestamp: nowAEDT.toISOString(),
        today: todayDayName,
        hoursAhead,
        reminders,
      }, null, 2));
    } else {
      const message = formatWhatsAppMessage(reminders, nowAEDT, todayDayName);
      console.log(message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
