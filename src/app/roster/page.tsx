'use client';

import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShiftModal } from '@/components/roster/shift-modal';
import { RosterPreview } from '@/components/roster/roster-preview';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { CalendarIcon, UserIcon, ClockIcon, DollarSignIcon, DownloadIcon, SettingsIcon, EditIcon, TrashIcon, CopyIcon, CoffeeIcon, ShieldCheckIcon, KeyIcon, UserCheckIcon, XIcon, ClipboardListIcon, ChevronUpIcon, ChevronDownIcon, PrinterIcon, FileImageIcon, SunIcon, SunriseIcon } from 'lucide-react';
import Link from 'next/link';

interface Staff {
  id: string;
  name: string;
  role: string;
  baseHourlyRate: number;
  saturdayHourlyRate?: number;
  sundayHourlyRate?: number;
  publicHolidayHourlyRate?: number;
  taxRate: number;
  superRate?: number | null;
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
// Day mapping: Monday=1, Tuesday=2, ..., Saturday=6, Sunday=0

// Helper function to convert DAYS array index to dayOfWeek
const getDayOfWeek = (dayIndex: number): number => {
  return dayIndex === 6 ? 0 : dayIndex + 1; // Sunday (index 6) → 0, Monday (index 0) → 1, etc.
};

// Helper function to get role icon and details
const getRoleIcon = (role: string, isBackupBarista: boolean = false) => {
  if (isBackupBarista) {
    return { icon: UserCheckIcon, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Backup Barista' };
  }
  
  switch (role?.toLowerCase()) {
    case 'manager':
      return { icon: KeyIcon, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Manager' };
    case 'open':
      return { icon: SunriseIcon, color: 'text-cyan-600', bgColor: 'bg-cyan-100', label: 'Open' };
    case 'open & close':
      return { icon: SunIcon, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Open & Close' };
    case 'close':
      return { icon: XIcon, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Close' };
    case 'barista':
      return { icon: CoffeeIcon, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Barista' };
    case 'kitchen':
      return { icon: ShieldCheckIcon, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Kitchen' };
    case 'roaming':
    case 'counter/roam':
      return { icon: UserIcon, color: 'text-pink-600', bgColor: 'bg-pink-100', label: 'Counter/Roam' };
    case 'junior':
      return { icon: UserIcon, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Junior' };
    case 'admin':
      return { icon: ClipboardListIcon, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Check-in/Admin' };
    default:
      return { icon: UserIcon, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Staff' };
  }
};

// Note: Penalty rates, tax rates, and super rates are now configured per employee in their individual settings

export default function RosterPage() {
  const toast = useToast();
  const [currentWeek, setCurrentWeek] = useState<Date>(getMonday(new Date()));
  const [roster, setRoster] = useState<Roster | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<RosterShift | null>(null);
  const [modalDayOfWeek, setModalDayOfWeek] = useState(1);
  const [modalDayName, setModalDayName] = useState('Monday');
  const [modalPreselectedStaff, setModalPreselectedStaff] = useState<string | null>(null);
  const [weeklySalesTarget, setWeeklySalesTarget] = useState(25000);
  const [targetWagePercentage, setTargetWagePercentage] = useState(30);
  const [staffOrder, setStaffOrder] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [currentWeek]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load staff
      const staffResponse = await fetch('/api/roster/staff');
      const staffResult = await staffResponse.json();
      if (staffResult.success) {
        setStaff(staffResult.data);
        // Initialize staff order if not set
        if (staffOrder.length === 0) {
          const initialOrder = staffResult.data
            .filter(s => s.isActive)
            .sort((a, b) => {
              const aIsJunior = a.role.toLowerCase().includes('junior');
              const bIsJunior = b.role.toLowerCase().includes('junior');
              if (aIsJunior !== bIsJunior) {
                return aIsJunior ? 1 : -1;
              }
              return a.name.localeCompare(b.name);
            })
            .map(s => s.id);
          setStaffOrder(initialOrder);
        }
      }

      // Load or create roster for current week
      const weekStr = formatDateForAPI(currentWeek);
      const rosterResponse = await fetch(`/api/roster/weekly?week=${weekStr}`);
      const rosterResult = await rosterResponse.json();
      
      if (rosterResult.success) {
        setRoster(rosterResult.data);
      }

      // Load settings
      const settingsResponse = await fetch('/api/settings');
      const settingsResult = await settingsResponse.json();
      if (settingsResult.success) {
        const data = settingsResult.data;
        if (data.weekly_sales_target?.value) {
          setWeeklySalesTarget(data.weekly_sales_target.value);
        }
        if (data.target_wage_percentage?.value) {
          setTargetWagePercentage(data.target_wage_percentage.value);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewRoster = async () => {
    try {
      setLoading(true);
      const weekStr = formatDateForAPI(currentWeek);
      
      const response = await fetch('/api/roster/weekly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          weekStartDate: weekStr,
          status: 'draft'
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        setRoster(result.data);
        // Reload data to ensure consistency
        await loadData();
      } else {
        console.error('Failed to create roster:', result.error);
        toast.error('Creation Failed', 'Failed to create roster. Please try again.');
      }
    } catch (error) {
      console.error('Error creating roster:', error);
      toast.error('Error', 'Error creating roster. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateRosterStatus = async (newStatus: 'draft' | 'published' | 'archived') => {
    if (!roster) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(`/api/roster/weekly/${roster.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const result = await response.json();
      if (result.success) {
        setRoster({ ...roster, status: newStatus });
        
        // Show appropriate message based on status and email results
        if (newStatus === 'published') {
          if (result.emailResults?.success) {
            const emailCount = result.emailResults.details?.emailsSent || 0;
            const failedCount = result.emailResults.details?.emailsFailed || 0;
            const noEmailCount = result.emailResults.details?.staffWithoutEmail || 0;
            
            let message = `Roster published successfully! ${emailCount} staff member${emailCount !== 1 ? 's' : ''} notified by email.`;
            if (failedCount > 0) {
              message += ` ${failedCount} email${failedCount !== 1 ? 's' : ''} failed to send.`;
            }
            if (noEmailCount > 0) {
              message += ` ${noEmailCount} staff member${noEmailCount !== 1 ? 's have' : ' has'} no email address.`;
            }
            toast.success('Roster Published', message);
          } else {
            toast.success('Roster Published', 'Roster published successfully! However, emails could not be sent automatically.');
          }
        } else if (newStatus === 'archived') {
          toast.success('Roster Archived', 'Roster archived successfully.');
        } else {
          toast.success('Status Updated', 'Roster moved back to draft.');
        }
        
        await loadData(); // Reload to ensure consistency
      } else {
        console.error('Failed to update roster status:', result.error);
        toast.error('Update Failed', 'Failed to update roster status. Please try again.');
      }
    } catch (error) {
      console.error('Error updating roster status:', error);
      toast.error('Error', 'Error updating roster status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const duplicateRosterToNextWeek = async () => {
    if (!roster) return;
    
    try {
      setLoading(true);
      
      // Calculate next week's date
      const nextWeek = new Date(currentWeek);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = formatDateForAPI(nextWeek);
      
      // Check if next week's roster already exists
      const checkResponse = await fetch(`/api/roster/weekly?week=${nextWeekStr}`);
      const checkResult = await checkResponse.json();
      
      if (checkResult.success && checkResult.data) {
        // Use toast with action for confirmation
        toast.addToast({
          type: 'warning',
          title: 'Roster Already Exists',
          message: `A roster already exists for next week (${nextWeekStr}). Do you want to overwrite it?`,
          duration: 0,
          action: {
            label: 'Overwrite',
            onClick: async () => {
              await performDuplication(nextWeekStr, nextWeek);
            }
          }
        });
        setLoading(false);
        return;
      }
      
      await performDuplication(nextWeekStr, nextWeek);
    } catch (error) {
      console.error('Error duplicating roster:', error);
      toast.error('Error', 'Error duplicating roster. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const performDuplication = async (nextWeekStr: string, nextWeek: Date) => {
    try {
      if (!roster) return;
      
      const response = await fetch('/api/roster/weekly/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceRosterId: roster.id,
          targetWeekStartDate: nextWeekStr,
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('Roster Duplicated', `Roster duplicated to next week (${nextWeekStr}) successfully!`);
        // Navigate to next week
        setCurrentWeek(nextWeek);
      } else {
        console.error('Failed to duplicate roster:', result.error);
        toast.error('Duplication Failed', 'Failed to duplicate roster. Please try again.');
      }
    } catch (error) {
      console.error('Error duplicating roster:', error);
      toast.error('Error', 'Error duplicating roster. Please try again.');
    }
  };

  const sendRosterSMS = async () => {
    if (!roster) return;

    try {
      setLoading(true);

      const response = await fetch(`/api/roster/weekly/${roster.id}/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (result.success) {
        const smsCount = result.details?.smsSent || 0;
        const failedCount = result.details?.smsFailed || 0;
        const staffWithPhones = result.details?.staffWithValidPhones || 0;

        let message = `SMS sent successfully! ${smsCount} staff member${smsCount !== 1 ? 's' : ''} notified.`;
        if (failedCount > 0) {
          message += ` (${failedCount} failed to send)`;
        }

        toast.success('Roster SMS Sent', message);
      } else {
        toast.error('Failed to send SMS', result.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error sending roster SMS:', error);
      toast.error('Failed to send SMS', 'An error occurred while sending roster SMS');
    } finally {
      setLoading(false);
    }
  };

  const sendRosterEmails = async () => {
    if (!roster) return;

    try {
      setLoading(true);

      const response = await fetch(`/api/roster/weekly/${roster.id}/send-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (result.success) {
        const emailCount = result.details?.emailsSent || 0;
        const failedCount = result.details?.emailsFailed || 0;
        const noEmailCount = result.details?.staffWithoutEmail || 0;
        
        let message = `Emails sent successfully! ${emailCount} staff member${emailCount !== 1 ? 's' : ''} notified.`;
        if (failedCount > 0) {
          message += ` ${failedCount} email${failedCount !== 1 ? 's' : ''} failed to send.`;
        }
        if (noEmailCount > 0) {
          message += ` ${noEmailCount} staff member${noEmailCount !== 1 ? 's have' : ' has'} no email address.`;
          
          if (result.details?.staffWithoutEmailList?.length > 0) {
            message += `\n\nStaff without email: ${result.details.staffWithoutEmailList.join(', ')}`;
          }
        }
        toast.success('Emails Sent', message);
      } else {
        console.error('Failed to send emails:', result.error);
        toast.error('Email Failed', `Failed to send emails: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending emails:', error);
      toast.error('Error', 'Error sending emails. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isPublicHoliday = async (date: Date): Promise<boolean> => {
    // For now, return false - we could implement this by checking the public_holidays table
    // or add a simple array of known public holidays
    return false;
  };

  const calculateShiftCost = (shift: RosterShift, date: Date) => {
    const startTime = parseTime(shift.startTime);
    const endTime = parseTime(shift.endTime);
    const totalMinutes = (endTime - startTime) / (1000 * 60);
    const workedMinutes = totalMinutes - shift.breakMinutes;
    const workedHours = workedMinutes / 60;

    let rate = shift.staff.baseHourlyRate;

    // Apply employee-specific penalty rates
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 6) { // Saturday
      rate = shift.staff.saturdayHourlyRate || shift.staff.baseHourlyRate;
    } else if (dayOfWeek === 0) { // Sunday
      rate = shift.staff.sundayHourlyRate || shift.staff.baseHourlyRate;
    }

    // TODO: Check for public holidays and apply publicHolidayHourlyRate
    // This would require an async check against the public_holidays table

    return rate * workedHours;
  };

  const calculateDailyCost = (dayOfWeek: number) => {
    if (!roster) return 0;
    
    const dayShifts = roster.shifts.filter(s => s.dayOfWeek === dayOfWeek);
    const date = new Date(currentWeek);
    date.setDate(date.getDate() + (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Adjust for Sunday
    
    return dayShifts.reduce((total, shift) => {
      return total + calculateShiftCost(shift, date);
    }, 0);
  };

  const calculateWeeklyCost = () => {
    return [1, 2, 3, 4, 5, 6, 0].reduce((total, day) => {
      return total + calculateDailyCost(day);
    }, 0);
  };

  const calculateStaffWeeklyHours = (staffId: string) => {
    if (!roster) return 0;

    return roster.shifts
      .filter(s => s.staffId === staffId)
      .reduce((total, shift) => {
        const startTime = parseTime(shift.startTime);
        const endTime = parseTime(shift.endTime);
        const totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        const workedMinutes = totalMinutes - shift.breakMinutes;
        const workedHours = workedMinutes / 60;
        return total + workedHours;
      }, 0);
  };

  const calculateStaffWeeklyCost = (staffId: string) => {
    if (!roster) return 0;

    return roster.shifts
      .filter(s => s.staffId === staffId)
      .reduce((total, shift) => {
        const shiftDate = new Date(currentWeek);
        const dayIndex = shift.dayOfWeek === 0 ? 6 : shift.dayOfWeek - 1; // Convert to array index
        shiftDate.setDate(shiftDate.getDate() + dayIndex);
        return total + calculateShiftCost(shift, shiftDate);
      }, 0);
  };

  const downloadAsImage = async () => {
    if (!previewRef.current) return;
    
    try {
      const html2canvas = await import('html2canvas').then((mod) => mod.default);
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: 'white',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const link = document.createElement('a');
      link.download = `wild-octave-roster-${formatDateForAPI(currentWeek)}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Export Failed', 'Failed to generate image. Please try again.');
    }
  };

  const downloadAsPDF = async () => {
    if (!previewRef.current) return;
    
    try {
      const html2canvas = await import('html2canvas').then((mod) => mod.default);
      const jsPDF = await import('jspdf').then((mod) => mod.default);
      
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: 'white',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const imgWidth = 297;
      const pageHeight = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`wild-octave-roster-${formatDateForAPI(currentWeek)}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Export Failed', 'Failed to generate PDF. Please try again.');
    }
  };

  const printRoster = () => {
    if (!previewRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Wild Octave Roster - ${formatDateForAPI(currentWeek)}</title>
            <style>
              body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${previewRef.current.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const validateDayShifts = (dayOfWeek: number) => {
    if (!roster) return { hasBarista8to430: false, hasManagerClosing: false, hasBackupBarista: false, hasJuniorCoverage: false, hasOpenCoverage: false };
    
    const dayShifts = roster.shifts.filter(s => s.dayOfWeek === dayOfWeek);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    
    // Check for barista covering 8:00-16:30 (combine multiple barista/backup shifts)
    // Staff can cover barista if: their role is barista, OR they have canDoBarista flag, OR shift has isBackupBarista
    const baristaShifts = dayShifts.filter(shift => {
      const isBarista = shift.role?.toLowerCase() === 'barista' || shift.staff.role.toLowerCase().includes('barista');
      const canDoBarista = shift.staff.canDoBarista === true;
      return isBarista || canDoBarista || shift.isBackupBarista;
    });
    
    // Check if the 8:00-16:30 period is covered by any combination of barista shifts
    const hasBarista8to430 = baristaShifts.some(shift => shift.startTime <= '08:00') && 
                             baristaShifts.some(shift => shift.endTime >= '16:30');
    
    // Check for manager closing (shifts ending after 17:00)
    const hasManagerClosing = dayShifts.some(shift => {
      const isManager = shift.role?.toLowerCase() === 'manager' || shift.staff.role.toLowerCase().includes('manager');
      const endTime = shift.endTime;
      return isManager && endTime >= '17:00';
    });
    
    // Check for backup barista availability
    const hasBackupBarista = dayShifts.some(shift => {
      return shift.isBackupBarista === true;
    });
    
    // Check for junior coverage (more flexible on weekends)
    const hasJuniorCoverage = dayShifts.some(shift => {
      const isJunior = shift.role?.toLowerCase() === 'junior' || shift.staff.role.toLowerCase().includes('junior');
      const startTime = shift.startTime;
      // For weekends, any junior shift counts. For weekdays, prefer afternoon/evening
      return isJunior && (isWeekend || startTime >= '14:00');
    });
    
    // Check for open coverage (early morning shifts - weekends open later)
    const hasOpenCoverage = dayShifts.some(shift => {
      const startTime = shift.startTime;
      const openTime = isWeekend ? '08:00' : '07:30'; // Weekends open at 8:00, weekdays at 7:30
      return startTime <= openTime; // Someone to open the store
    });
    
    return { hasBarista8to430, hasManagerClosing, hasBackupBarista, hasJuniorCoverage, hasOpenCoverage, isWeekend };
  };

  const moveStaffUp = (staffId: string) => {
    const currentIndex = staffOrder.indexOf(staffId);
    console.log(`Moving staff up: ${staffId}, current index: ${currentIndex}, staffOrder length: ${staffOrder.length}`);
    if (currentIndex > 0) {
      const newOrder = [...staffOrder];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      console.log(`New order:`, newOrder);
      setStaffOrder(newOrder);
    }
  };

  const moveStaffDown = (staffId: string) => {
    const currentIndex = staffOrder.indexOf(staffId);
    if (currentIndex < staffOrder.length - 1) {
      const newOrder = [...staffOrder];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      setStaffOrder(newOrder);
    }
  };

  const getPreviousShift = (staffId: string, currentDay: number) => {
    if (!roster) return null;
    
    // Find the most recent shift for this staff member (excluding current day)
    const staffShifts = roster.shifts
      .filter(s => s.staffId === staffId && s.dayOfWeek !== currentDay)
      .sort((a, b) => {
        // Sort by day proximity (closest day before current day)
        const aDayDiff = currentDay - a.dayOfWeek;
        const bDayDiff = currentDay - b.dayOfWeek;
        const aDistance = aDayDiff > 0 ? aDayDiff : aDayDiff + 7;
        const bDistance = bDayDiff > 0 ? bDayDiff : bDayDiff + 7;
        return aDistance - bDistance;
      });
    
    return staffShifts[0] || null;
  };

  const handleCopyPreviousShift = async (staffId: string, dayOfWeek: number) => {
    const previousShift = getPreviousShift(staffId, dayOfWeek);
    if (!previousShift) return;

    const newShift = {
      staffId,
      dayOfWeek,
      startTime: previousShift.startTime,
      endTime: previousShift.endTime,
      breakMinutes: previousShift.breakMinutes,
      role: previousShift.role,
      isBackupBarista: previousShift.isBackupBarista,
      notes: previousShift.notes
    };

    try {
      await handleSaveShift(newShift);
    } catch (error) {
      console.error('Error copying previous shift:', error);
      toast.error('Copy Failed', 'Failed to copy shift. Please try again.');
    }
  };

  const handleAddShift = (dayOfWeek: number, dayName: string, staffId?: string) => {
    setSelectedShift(null);
    setModalDayOfWeek(dayOfWeek);
    setModalDayName(dayName);
    setModalPreselectedStaff(staffId || null);
    setShiftModalOpen(true);
  };

  const handleEditShift = (shift: RosterShift, dayName: string) => {
    setSelectedShift(shift);
    setModalDayOfWeek(shift.dayOfWeek);
    setModalDayName(dayName);
    setShiftModalOpen(true);
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      // For now, we'll filter it out locally and update the roster
      // In a production app, you'd have a specific DELETE endpoint
      if (roster) {
        const updatedShifts = roster.shifts.filter(s => s.id !== shiftId);
        await updateRoster(updatedShifts);
      }
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error('Delete Failed', 'Failed to delete shift. Please try again.');
    }
  };

  const handleCopyShift = async (shift: RosterShift, targetDayOfWeek: number) => {
    try {
      if (!roster) return;

      const newShift: RosterShift = {
        id: `temp-${Date.now()}`,
        ...shift,
        dayOfWeek: targetDayOfWeek
      };
      
      const updatedShifts = [...roster.shifts, newShift];
      await updateRoster(updatedShifts);
    } catch (error) {
      console.error('Error copying shift:', error);
      toast.error('Copy Failed', 'Failed to copy shift. Please try again.');
    }
  };

  const handleSaveShift = async (shiftData: Omit<RosterShift, 'id'>) => {
    try {
      if (!roster) return;

      let updatedShifts;
      
      if (selectedShift) {
        // Update existing shift
        updatedShifts = roster.shifts.map(s => 
          s.id === selectedShift.id 
            ? { ...s, ...shiftData }
            : s
        );
      } else {
        // Add new shift
        const newShift: RosterShift = {
          id: `temp-${Date.now()}`, // Temporary ID
          ...shiftData,
          staff: staff.find(s => s.id === shiftData.staffId)!
        };
        updatedShifts = [...roster.shifts, newShift];
      }

      await updateRoster(updatedShifts);
    } catch (error) {
      console.error('Error saving shift:', error);
      throw error;
    }
  };

  const updateRoster = async (shifts: RosterShift[]) => {
    const weekStr = formatDateForAPI(currentWeek);
    
    const response = await fetch(`/api/roster/weekly`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        weekStartDate: weekStr,
        shifts: shifts.map(s => ({
          staffId: s.staffId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          breakMinutes: s.breakMinutes,
          role: s.role || undefined,
          isBackupBarista: s.isBackupBarista || false,
          notes: s.notes
        }))
      })
    });

    const result = await response.json();
    if (result.success) {
      setRoster(result.data);
    } else {
      throw new Error(result.error);
    }
  };

  const weeklyCost = calculateWeeklyCost();
  
  // Calculate tax and super per staff member based on their individual rates
  const calculateStaffTaxAndSuper = () => {
    if (!roster) return { totalTax: 0, totalSuper: 0 };
    
    let totalTax = 0;
    let totalSuper = 0;
    
    // Group shifts by staff and calculate their costs
    const staffCosts = new Map<string, { gross: number; staffMember: Staff | undefined }>();
    
    roster.shifts.forEach(shift => {
      const shiftDate = new Date(currentWeek);
      const dayIndex = shift.dayOfWeek === 0 ? 6 : shift.dayOfWeek - 1;
      shiftDate.setDate(shiftDate.getDate() + dayIndex);
      const cost = calculateShiftCost(shift, shiftDate);
      
      const existing = staffCosts.get(shift.staffId);
      const staffMember = staff.find(s => s.id === shift.staffId);
      if (existing) {
        existing.gross += cost;
      } else {
        staffCosts.set(shift.staffId, { gross: cost, staffMember });
      }
    });
    
    // Calculate tax and super for each staff member based on their rates
    staffCosts.forEach(({ gross, staffMember }) => {
      if (staffMember) {
        // Tax calculation: use individual taxRate (defaults to 30% if undefined)
        const taxRate = (staffMember.taxRate ?? 30) / 100;
        totalTax += gross * taxRate;
        
        // Super calculation: use individual superRate (null = no super, e.g., juniors)
        if (staffMember.superRate !== null && staffMember.superRate !== undefined) {
          const superRate = staffMember.superRate / 100;
          totalSuper += gross * superRate;
        }
      }
    });
    
    return { totalTax, totalSuper };
  };
  
  const { totalTax: taxAmount, totalSuper: superAmount } = calculateStaffTaxAndSuper();
  const totalCost = weeklyCost + taxAmount + superAmount;
  const targetWageCost = weeklySalesTarget * (targetWagePercentage / 100);
  const wageDifference = totalCost - targetWageCost;
  const wagePercentageActual = weeklySalesTarget > 0 ? (totalCost / weeklySalesTarget * 100) : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Staff Roster</h1>
                <p className="text-blue-100 text-lg">
                  Week of {formatDateDisplay(currentWeek)} - {formatDateDisplay(addDays(currentWeek, 6))}
                </p>
              </div>
              <div className="mt-4 lg:mt-0 flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                >
                  ← Previous Week
                </Button>
                <Button
                  onClick={() => setCurrentWeek(getMonday(new Date()))}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                >
                  This Week
                </Button>
                <Button
                  onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                >
                  Next Week →
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      if (roster) {
                        await updateRoster(roster.shifts);
                        toast.success('Roster Saved', 'Roster saved successfully!');
                      }
                    } catch (error) {
                      toast.error('Save Failed', 'Failed to save roster. Please try again.');
                    }
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold"
                >
                  💾 Save Roster
                </Button>
                <Button
                  onClick={async () => {
                    toast.addToast({
                      type: 'warning',
                      title: 'Clear All Shifts?',
                      message: 'This action cannot be undone',
                      duration: 0,
                      action: {
                        label: 'Clear All',
                        onClick: async () => {
                          try {
                            await updateRoster([]);
                            toast.success('Roster Cleared', 'Roster cleared successfully!');
                          } catch (error) {
                            toast.error('Clear Failed', 'Failed to clear roster. Please try again.');
                          }
                        }
                      }
                    });
                  }}
                  variant="destructive"
                  className="font-semibold"
                >
                  🗑️ Clear Roster
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Roster Status and Workflow Management */}
        {roster && (
          <div className="mb-6">
            <Card className="border-2 border-gray-200">
              <CardHeader className="bg-gray-50">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardListIcon className="w-5 h-5" />
                  Roster Workflow Management
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Current Status:</p>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          roster.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                          roster.status === 'published' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {roster.status === 'draft' ? '📝 Draft' :
                           roster.status === 'published' ? '✅ Published' :
                           '📦 Archived'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Week {formatDateDisplay(currentWeek)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {roster.status === 'draft' && (
                      <>
                        <Button
                          onClick={() => updateRosterStatus('published')}
                          disabled={loading}
                          className="bg-green-500 hover:bg-green-600 text-white"
                        >
                          📢 Publish Roster
                        </Button>
                        <Button
                          onClick={duplicateRosterToNextWeek}
                          disabled={loading}
                          variant="outline"
                          className="border-blue-500 text-blue-600 hover:bg-blue-50"
                        >
                          📅 Duplicate to Next Week
                        </Button>
                      </>
                    )}
                    
                    {roster.status === 'published' && (
                      <>
                        <Button
                          onClick={() => updateRosterStatus('draft')}
                          disabled={loading}
                          variant="outline"
                          className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                        >
                          📝 Back to Draft
                        </Button>
                        <Button
                          onClick={() => updateRosterStatus('archived')}
                          disabled={loading}
                          variant="outline"
                          className="border-gray-500 text-gray-600 hover:bg-gray-50"
                        >
                          📦 Archive Roster
                        </Button>
                        <Button
                          onClick={duplicateRosterToNextWeek}
                          disabled={loading}
                          variant="outline"
                          className="border-blue-500 text-blue-600 hover:bg-blue-50"
                        >
                          📅 Duplicate to Next Week
                        </Button>
                      </>
                    )}
                    
                    {roster.status === 'archived' && (
                      <Button
                        onClick={() => updateRosterStatus('draft')}
                        disabled={loading}
                        variant="outline"
                        className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                      >
                        📝 Reopen as Draft
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => setShowPreview(true)}
                      variant="outline"
                      className="border-purple-500 text-purple-600 hover:bg-purple-50"
                    >
                      👁️ Preview & Download
                    </Button>
                    
                    {roster.status === 'published' && (
                      <>
                        <Button
                          onClick={sendRosterEmails}
                          disabled={loading}
                          variant="outline"
                          className="border-green-500 text-green-600 hover:bg-green-50"
                        >
                          📧 Send Emails Again
                        </Button>
                        <Button
                          onClick={sendRosterSMS}
                          disabled={loading}
                          variant="outline"
                          className="border-blue-500 text-blue-600 hover:bg-blue-50"
                        >
                          📱 Send SMS
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {roster.status === 'draft' && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      💡 <strong>Tip:</strong> Usually rosters are finalized on Friday and published for the next week. 
                      Use "Duplicate to Next Week" to copy the current roster as a starting template.
                    </p>
                  </div>
                )}
                
                {roster.status === 'published' && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✅ <strong>Published:</strong> This roster is live and staff have been notified. 
                      Changes should be minimal unless urgent.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sales Target and Wage Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Weekly Sales Target</p>
                  <p className="text-3xl font-bold">{formatCurrency(weeklySalesTarget)}</p>
                  <p className="text-sm opacity-75 mt-1">Target wage: {targetWagePercentage}% = {formatCurrency(targetWageCost)}</p>
                </div>
                <DollarSignIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-0 text-white ${
            wageDifference <= 0
              ? 'bg-gradient-to-r from-green-500 to-emerald-600'
              : wageDifference <= targetWageCost * 0.1
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
              : 'bg-gradient-to-r from-red-500 to-pink-600'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Actual Wages vs Target</p>
                  <p className="text-3xl font-bold">{wagePercentageActual.toFixed(1)}%</p>
                  <p className="text-sm opacity-75 mt-1">
                    {wageDifference <= 0 ? 'Under by ' : 'Over by '}
                    {formatCurrency(Math.abs(wageDifference))}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    wageDifference <= 0
                      ? 'text-green-100'
                      : wageDifference <= targetWageCost * 0.1
                      ? 'text-yellow-100'
                      : 'text-red-100'
                  }`}>
                    {wageDifference <= 0 ? '✓' : '!'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSignIcon className="w-6 h-6" />
                <div>
                  <p className="text-sm opacity-90">Weekly Wages</p>
                  <p className="text-xl font-bold">{formatCurrency(weeklyCost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <ClockIcon className="w-6 h-6" />
                <div>
                  <p className="text-sm opacity-90">Tax (per person)</p>
                  <p className="text-xl font-bold">{formatCurrency(taxAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <UserIcon className="w-6 h-6" />
                <div>
                  <p className="text-sm opacity-90">Super (per person)</p>
                  <p className="text-xl font-bold">{formatCurrency(superAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-6 h-6" />
                <div>
                  <p className="text-sm opacity-90">Total Cost</p>
                  <p className="text-xl font-bold">{formatCurrency(totalCost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Link href="/roster/admin">
            <Button variant="outline" className="flex items-center space-x-2 text-gray-900">
              <SettingsIcon className="w-4 h-4" />
              <span>Manage Staff & Rates</span>
            </Button>
          </Link>
          <Button 
            variant="outline" 
            className="flex items-center space-x-2 text-gray-900"
            onClick={() => setShowPreview(true)}
          >
            <FileImageIcon className="w-4 h-4" />
            <span>Preview & Download</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2 text-gray-900">
            <CalendarIcon className="w-4 h-4" />
            <span>Copy Last Week</span>
          </Button>
        </div>

        {/* Shift Validation Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5" />
              <span>Shift Coverage Validation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-4">
              {DAYS.map((day, index) => {
                const dayOfWeek = getDayOfWeek(index);
                const validation = validateDayShifts(dayOfWeek);
                const hasIssues = !validation.hasBarista8to430 || !validation.hasManagerClosing || !validation.hasOpenCoverage || 
                  (validation.isWeekend && !validation.hasJuniorCoverage);
                
                return (
                  <div key={day} className={`p-2 rounded-lg border-2 ${
                    hasIssues 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-green-300 bg-green-50'
                  }`}>
                    <div className="text-center">
                      <div className="font-semibold text-xs mb-1">{day}</div>
                      <div className="space-y-0.5">
                        <div className={`text-xs flex items-center justify-center space-x-1 ${
                          validation.hasOpenCoverage ? 'text-green-700' : 'text-red-700'
                        }`}>
                          <span>{validation.hasOpenCoverage ? '✓' : '✗'}</span>
                          <span>Open</span>
                        </div>
                        <div className={`text-xs flex items-center justify-center space-x-1 ${
                          validation.hasBarista8to430 ? 'text-green-700' : 'text-red-700'
                        }`}>
                          <span>{validation.hasBarista8to430 ? '✓' : '✗'}</span>
                          <span>Barista 8-4:30</span>
                        </div>
                        <div className={`text-xs flex items-center justify-center space-x-1 ${
                          validation.hasBackupBarista ? 'text-green-700' : 'text-orange-600'
                        }`}>
                          <span>{validation.hasBackupBarista ? '✓' : '○'}</span>
                          <span>Backup</span>
                        </div>
                        <div className={`text-xs flex items-center justify-center space-x-1 ${
                          validation.hasJuniorCoverage ? 'text-green-700' : 
                          (validation.isWeekend ? 'text-red-700' : 'text-orange-600')
                        }`}>
                          <span>{validation.hasJuniorCoverage ? '✓' : 
                            (validation.isWeekend ? '✗' : '○')}</span>
                          <span>Junior</span>
                        </div>
                        <div className={`text-xs flex items-center justify-center space-x-1 ${
                          validation.hasManagerClosing ? 'text-green-700' : 'text-red-700'
                        }`}>
                          <span>{validation.hasManagerClosing ? '✓' : '✗'}</span>
                          <span>Close</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Roster Grid - New Design */}
        <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${roster?.status === 'archived' ? 'opacity-75' : ''}`}>
          {/* Day Headers */}
          <div className="grid grid-cols-9 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 sticky top-0 z-10">
            <div className="p-3 border-r border-white/20">
              <h2 className="text-white text-lg font-bold">Staff</h2>
            </div>
            {DAYS.map((day, index) => {
              const dayOfWeek = getDayOfWeek(index);
              const dayDate = new Date(currentWeek);
              dayDate.setDate(dayDate.getDate() + index);
              const isPenaltyRate = dayOfWeek === 6 || dayOfWeek === 0;

              return (
                <div key={day} className="p-3 text-center border-r border-white/20">
                  <div className="text-white">
                    <div className="text-lg font-bold">{day}</div>
                    <div className="text-xs opacity-90">
                      {dayDate.getDate()}/{dayDate.getMonth() + 1}
                    </div>
                    {isPenaltyRate && (
                      <div className="mt-1 inline-block bg-yellow-400 text-yellow-900 text-xs px-1 py-0.5 rounded font-medium">
                        {dayOfWeek === 6 ? '1.5x' : '2x'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="p-3 text-center">
              <div className="text-white">
                <div className="text-lg font-bold">Total</div>
                <div className="text-xs opacity-90">Hours & Cost</div>
              </div>
            </div>
          </div>

          {/* Staff Rows */}
          <div className="divide-y divide-gray-200">
            {staffOrder
              .map((id, index) => ({ person: staff.find(s => s.id === id), originalIndex: index }))
              .filter(item => item.person && item.person.isActive)
              .map(({ person, originalIndex }) => {
                const isJunior = person.role.toLowerCase().includes('junior');
                return (
                  <div key={person.id} className={`grid grid-cols-9 min-h-[80px] ${isJunior ? 'bg-blue-50' : 'bg-white'} hover:bg-gray-50 transition-colors`}>
                    {/* Staff Name Column */}
                    <div className={`p-4 border-r border-gray-200 flex items-center justify-between ${isJunior ? 'bg-blue-100 border-blue-200' : 'bg-gray-50'}`}>
                      <div>
                        <div className={`text-base font-bold ${isJunior ? 'text-blue-800' : 'text-gray-900'}`}>
                          {person.name}
                        </div>
                        <div className={`text-xs ${isJunior ? 'text-blue-600' : 'text-gray-600'}`}>
                          {person.role} • ${person.baseHourlyRate}/hr
                        </div>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-white/50"
                          onClick={() => moveStaffUp(person.id)}
                          disabled={originalIndex === 0}
                        >
                          <ChevronUpIcon className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-white/50"
                          onClick={() => moveStaffDown(person.id)}
                          disabled={originalIndex === staffOrder.length - 1}
                        >
                          <ChevronDownIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Day Columns */}
                    {DAYS.map((day, index) => {
                      const dayOfWeek = getDayOfWeek(index);
                      const shift = roster?.shifts.find(s => s.staffId === person.id && s.dayOfWeek === dayOfWeek);
                      const isPenaltyRate = dayOfWeek === 6 || dayOfWeek === 0;
                      
                      return (
                        <div
                          key={`${person.id}-${day}`}
                          className={`p-3 border-r border-gray-200 flex items-center justify-center min-h-[80px] ${isPenaltyRate ? 'bg-yellow-50' : ''}`}
                        >
                          {shift ? (
                            <div className="group relative w-full">
                              <div 
                                onClick={() => roster?.status !== 'archived' && handleEditShift(shift, day)}
                                className={`p-4 rounded-lg border-2 text-center transition-all duration-200 hover:shadow-lg cursor-pointer ${
                                shift.role === 'junior' || isJunior
                                  ? 'bg-blue-100 border-blue-300 hover:bg-blue-200'
                                  : shift.role === 'manager'
                                  ? 'bg-green-100 border-green-300 hover:bg-green-200'
                                  : shift.role === 'barista'
                                  ? 'bg-purple-100 border-purple-300 hover:bg-purple-200'
                                  : shift.role === 'kitchen'
                                  ? 'bg-orange-100 border-orange-300 hover:bg-orange-200'
                                  : shift.role === 'roaming'
                                  ? 'bg-pink-100 border-pink-300 hover:bg-pink-200'
                                  : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                              }`}>
                                {/* Role Icons */}
                                <div className="flex items-center justify-center space-x-1 mb-2">
                                  {(() => {
                                    const roleInfo = getRoleIcon(shift.role || '', shift.isBackupBarista);
                                    const IconComponent = roleInfo.icon;
                                    return (
                                      <>
                                        <IconComponent className={`w-4 h-4 ${roleInfo.color}`} />
                                        {shift.isBackupBarista && (
                                          <CoffeeIcon className="w-3 h-3 text-purple-600" title="Backup Barista" />
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                                <div className={`text-lg font-bold ${
                                  shift.role === 'junior' || isJunior
                                    ? 'text-blue-800'
                                    : shift.role === 'manager'
                                    ? 'text-green-800'
                                    : shift.role === 'barista'
                                    ? 'text-purple-800'
                                    : shift.role === 'kitchen'
                                    ? 'text-orange-800'
                                    : shift.role === 'roaming'
                                    ? 'text-pink-800'
                                    : 'text-gray-800'
                                }`}>
                                  {person.name.split(' ')[0]}
                                </div>
                                <div className={`text-base font-semibold ${
                                  shift.role === 'junior' || isJunior
                                    ? 'text-blue-700'
                                    : shift.role === 'manager'
                                    ? 'text-green-700'
                                    : shift.role === 'barista'
                                    ? 'text-purple-700'
                                    : shift.role === 'kitchen'
                                    ? 'text-orange-700'
                                    : shift.role === 'roaming'
                                    ? 'text-pink-700'
                                    : 'text-gray-700'
                                }`}>
                                  {formatTime(shift.startTime)}-{formatTime(shift.endTime)}
                                </div>
                                {shift.role && (
                                  <div className="flex items-center justify-center space-x-2 mt-1">
                                    {(() => {
                                      const roleInfo = getRoleIcon(shift.role, shift.isBackupBarista);
                                      const IconComponent = roleInfo.icon;
                                      return (
                                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${roleInfo.bgColor} ${roleInfo.color}`}>
                                          <IconComponent className="w-3 h-3" />
                                          <span className="capitalize">{shift.isBackupBarista ? 'Backup Barista' : shift.role}</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  {calculateShiftDuration(shift.startTime, shift.endTime, shift.breakMinutes)}h
                                </div>
                                {shift.notes && (
                                  <div className="text-xs text-gray-500 mt-1 truncate" title={shift.notes}>
                                    {shift.notes}
                                  </div>
                                )}
                              </div>
                              
                              {/* Quick Action Buttons */}
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 bg-red-500/90 backdrop-blur-sm shadow-sm hover:bg-red-600 border border-red-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteShift(shift.id);
                                  }}
                                  title="Delete shift"
                                >
                                  <XIcon className="w-3 h-3 text-white" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full min-h-[80px] flex flex-col">
                              {(() => {
                                const previousShift = getPreviousShift(person.id, dayOfWeek);
                                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                                
                                if (previousShift) {
                                  return (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 text-gray-500 hover:text-green-600 transition-all duration-200 mb-1"
                                        onClick={() => handleCopyPreviousShift(person.id, dayOfWeek)}
                                      >
                                        <div className="text-center">
                                          <div className="text-sm mb-1">📋 Copy {dayNames[previousShift.dayOfWeek]}</div>
                                          <div className="text-xs">{formatTime(previousShift.startTime)}-{formatTime(previousShift.endTime)}</div>
                                        </div>
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-all duration-200"
                                        onClick={() => roster?.status !== 'archived' && handleAddShift(dayOfWeek, day, person.id)}
                                      >
                                        <div className="text-center">
                                          <div className="text-lg">+</div>
                                          <div className="text-xs">New Shift</div>
                                        </div>
                                      </Button>
                                    </>
                                  );
                                } else {
                                  return (
                                    <Button
                                      variant="ghost"
                                      size="lg"
                                      className="w-full h-full border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-all duration-200"
                                      onClick={() => roster?.status !== 'archived' && handleAddShift(dayOfWeek, day, person.id)}
                                    >
                                      <div className="text-center">
                                        <div className="text-2xl mb-1">+</div>
                                        <div className="text-sm">Add Shift</div>
                                      </div>
                                    </Button>
                                  );
                                }
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Staff Totals Column */}
                    <div className={`p-4 flex items-center justify-center min-h-[80px] ${isJunior ? 'bg-blue-100' : 'bg-gray-50'} border-l border-gray-300`}>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${isJunior ? 'text-blue-800' : 'text-gray-900'}`}>
                          {calculateStaffWeeklyHours(person.id).toFixed(1)}h
                        </div>
                        <div className={`text-base font-semibold ${isJunior ? 'text-blue-700' : 'text-gray-700'}`}>
                          {formatCurrency(calculateStaffWeeklyCost(person.id))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            }
            
            {/* Daily Totals Row */}
            <div className="grid grid-cols-9 bg-gradient-to-r from-blue-100 to-purple-100 border-t-2 border-blue-200">
              <div className="p-4 border-r border-blue-200 bg-blue-200 flex items-center">
                <div className="text-blue-900 font-bold text-lg">Daily Total</div>
              </div>
              {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek, index) => (
                <div key={dayOfWeek} className="p-4 text-center flex items-center justify-center border-r border-blue-200">
                  <div className="text-blue-900 font-bold text-lg">
                    {formatCurrency(calculateDailyCost(dayOfWeek))}
                  </div>
                </div>
              ))}
              {/* Weekly Total */}
              <div className="p-4 text-center flex items-center justify-center bg-blue-200 border-l border-blue-300">
                <div className="text-center">
                  <div className="text-blue-900 font-bold text-lg">
                    {formatCurrency(weeklyCost)}
                  </div>
                  <div className="text-blue-800 text-sm font-medium">
                    Weekly Total
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Empty state when no roster */}
        {!roster && (
          <Card className="text-center py-12">
            <CardContent>
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Roster Found</h3>
              <p className="text-gray-600 mb-4">
                There's no roster for this week yet. Create one to get started.
              </p>
              <Button onClick={createNewRoster} disabled={loading}>
                {loading ? 'Creating...' : 'Create New Roster'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Shift Modal */}
        <ShiftModal
          isOpen={shiftModalOpen}
          onClose={() => {
            setShiftModalOpen(false);
            setSelectedShift(null);
            setModalPreselectedStaff(null);
          }}
          onSave={handleSaveShift}
          shift={selectedShift}
          staff={staff}
          dayOfWeek={modalDayOfWeek}
          dayName={modalDayName}
          preselectedStaffId={modalPreselectedStaff}
          existingShifts={roster?.shifts || []}
        />
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-screen overflow-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Roster Preview</h3>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadAsImage}
                    className="flex items-center space-x-1 text-gray-900"
                  >
                    <FileImageIcon className="w-4 h-4" />
                    <span>Download PNG</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadAsPDF}
                    className="flex items-center space-x-1 text-gray-900"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    <span>Download PDF</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={printRoster}
                    className="flex items-center space-x-1 text-gray-900"
                  >
                    <PrinterIcon className="w-4 h-4" />
                    <span>Print</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(false)}
                    className="ml-2"
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-4">
              <RosterPreview
                ref={previewRef}
                roster={roster}
                staff={staff}
                weekStartDate={currentWeek}
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// Utility functions
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateForAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(timeString: string): string {
  return timeString; // Return 24-hour format as-is
}

function parseTime(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function calculateShiftDuration(startTime: string, endTime: string, breakMinutes: number): string {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  const workedMinutes = totalMinutes - breakMinutes;
  return (workedMinutes / 60).toFixed(1);
}