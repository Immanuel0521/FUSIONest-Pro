/**
 * Centralized Attendance Configuration
 * Single source of truth for all attendance rules and calculations
 */

// ============ SHIFT TIMING ============
export const SHIFT_START_HOUR = 9; // 9:00 AM
export const SHIFT_END_HOUR = 18; // 6:00 PM (18:00)
export const SHIFT_START_TIME = "09:00";
export const SHIFT_END_TIME = "18:00";

// ============ LUNCH BREAK ============
export const LUNCH_START_HOUR = 13; // 1:00 PM
export const LUNCH_END_HOUR = 14; // 2:00 PM
export const LUNCH_BREAK_HOURS = 1; // 1 hour unpaid lunch break

// ============ PAYABLE HOURS ============
// 9 AM to 6 PM = 9 hours, minus 1 hour lunch = 8 payable hours
export const STANDARD_PAYABLE_HOURS = 8;

// ============ TOLERANCE WINDOWS ============

// Login Tolerance: 8:40 AM - 9:20 AM is normal (no late flag)
export const EARLY_LOGIN_ALLOWED_HOUR = 8;
export const EARLY_LOGIN_ALLOWED_MINUTE = 40; // 8:40 AM

export const NORMAL_LOGIN_END_HOUR = 9;
export const NORMAL_LOGIN_END_MINUTE = 20; // 9:20 AM

// Late Entry: Only after 9:30 AM
export const LATE_THRESHOLD_HOUR = 9;
export const LATE_THRESHOLD_MINUTE = 30; // 9:30 AM

// Logout Tolerance: 5:40 PM - 6:20 PM is normal (no early flag)
export const NORMAL_LOGOUT_START_HOUR = 17;
export const NORMAL_LOGOUT_START_MINUTE = 40; // 5:40 PM

export const NORMAL_LOGOUT_END_HOUR = 18;
export const NORMAL_LOGOUT_END_MINUTE = 20; // 6:20 PM

// Early Exit: Only before 5:30 PM
export const EARLY_EXIT_THRESHOLD_HOUR = 17;
export const EARLY_EXIT_THRESHOLD_MINUTE = 30; // 5:30 PM

// ============ EARLY MORNING OT ============
// Login before 8:50 AM counts as early OT (from login to 9:00 AM)
// Login between 8:50 - 9:00 AM is treated as normal 9:00 AM (no early OT)
export const EARLY_OT_THRESHOLD_HOUR = 8;
export const EARLY_OT_THRESHOLD_MINUTE = 50; // 8:50 AM

// ============ OVERTIME ============
// Overtime starts after 8 payable hours of work
export const OVERTIME_THRESHOLD_HOURS = STANDARD_PAYABLE_HOURS;

// OT: NO tolerance/grace period. Any time after exactly 18:00 is OT.
export const OT_TOLERANCE_MINUTES = 0;
export const NO_OT_CUTOFF_HOUR = 18;
export const NO_OT_CUTOFF_MINUTE = 0; // Exactly 6:00 PM - OT counted immediately after

// ============ HELPER FUNCTIONS ============

/**
 * Check if a login time is considered late
 * Late only if after 9:30 AM
 */
export function isLateLogin(time: Date): boolean {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const lateThreshold = LATE_THRESHOLD_HOUR * 60 + LATE_THRESHOLD_MINUTE;
  return totalMinutes > lateThreshold;
}

/**
 * Calculate late minutes (only if actually late - after 9:30 AM)
 * Late minutes calculated from 9:00 AM (shift start)
 */
export function calculateLateMinutes(time: Date): number {
  if (!isLateLogin(time)) return 0;
  
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const shiftStartMinutes = SHIFT_START_HOUR * 60;
  
  return Math.max(0, totalMinutes - shiftStartMinutes);
}

/**
 * Check if a logout time is considered early exit
 * Early only if before 5:30 PM
 */
export function isEarlyExit(time: Date): boolean {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const earlyThreshold = EARLY_EXIT_THRESHOLD_HOUR * 60 + EARLY_EXIT_THRESHOLD_MINUTE;
  return totalMinutes < earlyThreshold;
}

/**
 * Calculate working hours with lunch break deduction
 * Working Hours = (Checkout - Checkin) - 1 hour lunch
 * Capped at 8 hours maximum for regular pay
 */
export function calculateWorkingHours(checkIn: Date, checkOut: Date): number {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Deduct 1 hour for lunch break
  const workingHours = Math.max(0, diffHours - LUNCH_BREAK_HOURS);
  
  // Cap at 8 hours for regular working hours
  return Math.min(workingHours, STANDARD_PAYABLE_HOURS);
}

/**
 * Calculate raw hours worked (without cap, but with lunch deduction)
 * Used for OT calculation
 */
export function calculateTotalHoursWorked(checkIn: Date, checkOut: Date): number {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Deduct 1 hour for lunch break
  return Math.max(0, diffHours - LUNCH_BREAK_HOURS);
}

/**
 * Calculate early morning OT hours
 * If login is before 8:50 AM, OT = (9:00 AM - login time) in hours
 * If login is between 8:50 - 9:00 AM, treated as normal (no early OT)
 */
export function calculateEarlyOT(checkIn: Date): number {
  const earlyOtThreshold = new Date(checkIn);
  earlyOtThreshold.setHours(EARLY_OT_THRESHOLD_HOUR, EARLY_OT_THRESHOLD_MINUTE, 0, 0);
  
  const shiftStart = new Date(checkIn);
  shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
  
  // If login is before 8:50 AM, count as early OT
  if (checkIn < earlyOtThreshold) {
    const earlyOtMs = shiftStart.getTime() - checkIn.getTime();
    return Math.max(0, earlyOtMs / (1000 * 60 * 60));
  }
  
  return 0;
}

/**
 * Calculate evening overtime hours.
 *
 * Rule: OT starts only after a full 8-hour workday (plus 1 h lunch) from the
 * *effective* shift start — which is the later of actual check-in or 09:00.
 *
 *   Effective shift end = max(checkIn, 09:00) + 9 h
 *
 * Examples:
 *   09:00 login → OT after 18:00  (unchanged)
 *   09:30 login → OT after 18:30  (30-min late worker not penalised)
 *   08:00 login → OT after 18:00  (early OT counted separately via calculateEarlyOT)
 *
 * Supports overnight checkout.
 */
export function calculateEveningOT(checkIn: Date, checkOut: Date): number {
  // Determine the effective shift base (cannot be earlier than 09:00)
  const checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();
  const shiftStartMinutes = SHIFT_START_HOUR * 60;

  const shiftBase = new Date(checkIn);
  if (checkInMinutes < shiftStartMinutes) {
    // Early check-in: use fixed 09:00 as base so early-OT is not double-counted
    shiftBase.setHours(SHIFT_START_HOUR, 0, 0, 0);
  }
  // else: use actual check-in time as the shift base

  // Effective end = shiftBase + 8 payable hours + 1 h lunch = +9 h
  const effectiveShiftEndMs =
    shiftBase.getTime() + (STANDARD_PAYABLE_HOURS + LUNCH_BREAK_HOURS) * 3_600_000;
  const effectiveShiftEnd = new Date(effectiveShiftEndMs);

  if (checkOut <= effectiveShiftEnd) {
    return 0;
  }

  return Math.max(0, (checkOut.getTime() - effectiveShiftEndMs) / 3_600_000);
}

/**
 * Calculate total overtime hours (early morning + evening)
 * Early OT: login before 8:50 AM → OT from login to 9:00 AM
 * Evening OT: checkout after 6:00 PM → OT from 6:00 PM to checkout
 * Supports overnight checkout
 */
export function calculateOvertimeHours(checkIn: Date, checkOut: Date): number {
  const earlyOT = calculateEarlyOT(checkIn);
  const eveningOT = calculateEveningOT(checkIn, checkOut);
  return earlyOT + eveningOT;
}

/**
 * Check if a date is a Sunday
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Get working days in a month (excluding Sundays only)
 * Saturdays ARE working days
 */
export function getWorkingDaysInMonth(year: number, month: number, upToDate?: Date): Date[] {
  const days: Date[] = [];
  const startDate = new Date(year, month, 1);
  
  // If upToDate is provided, use it as the end date (for current month reports)
  // Otherwise use the last day of the month
  let endDate: Date;
  if (upToDate && upToDate.getMonth() === month && upToDate.getFullYear() === year) {
    endDate = upToDate;
  } else {
    endDate = new Date(year, month + 1, 0); // Last day of month
  }
  
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // Only exclude Sundays (day 0), NOT Saturdays
    if (currentDate.getDay() !== 0) {
      days.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
}

/**
 * Get all Sundays in a month
 */
export function getSundaysInMonth(year: number, month: number, upToDate?: Date): Date[] {
  const sundays: Date[] = [];
  const startDate = new Date(year, month, 1);
  
  let endDate: Date;
  if (upToDate && upToDate.getMonth() === month && upToDate.getFullYear() === year) {
    endDate = upToDate;
  } else {
    endDate = new Date(year, month + 1, 0);
  }
  
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (currentDate.getDay() === 0) {
      sundays.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return sundays;
}

/**
 * Format time for display (HH:MM AM/PM)
 */
export function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format hours to hours and minutes string
 */
export function formatHoursMinutes(hours: number): { hours: number; minutes: number; display: string } {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return {
    hours: wholeHours,
    minutes,
    display: `${wholeHours}h ${minutes}m`
  };
}

/**
 * Calculate salary based on working days and rates
 */
export function calculateSalary(
  workingDays: number,
  monthlySalary: number,
  otHours: number,
  otRatePerHour: number
): {
  perDayWage: number;
  basicSalary: number;
  otAmount: number;
  finalSalary: number;
} {
  // Per day wage based on 31 days (standard month)
  const perDayWage = monthlySalary / 31;
  const basicSalary = workingDays * perDayWage;
  const otAmount = otHours * otRatePerHour;
  const finalSalary = basicSalary + otAmount;
  
  return {
    perDayWage: Math.round(perDayWage * 100) / 100,
    basicSalary: Math.round(basicSalary * 100) / 100,
    otAmount: Math.round(otAmount * 100) / 100,
    finalSalary: Math.round(finalSalary * 100) / 100
  };
}
