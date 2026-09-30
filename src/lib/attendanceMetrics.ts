/**
 * Shared attendance metric helpers.
 * Single source of truth used by manual entry, edits and reports so that
 * hours / OT never differ between screens.
 *
 * Rules:
 *  - 8 payable hours per day regardless of login/logout time.
 *  - 1 h unpaid lunch deducted from raw hours (skipped when rawHours <= 1 h).
 *  - Early OT  : any time worked before 09:00 AM.
 *  - Evening OT: max(0, workedHours - earlyOT - 8).
 *                Late starters (e.g. 10 AM–7 PM = exactly 8 h) → 0 OT.
 *  - Sunday    : all hours OT (minus 1 h lunch).
 *  - Night shift (login >= 18:00): all hours OT, no lunch deduction.
 */
import {
  STANDARD_PAYABLE_HOURS,
  LUNCH_BREAK_HOURS,
  LATE_THRESHOLD_HOUR,
  LATE_THRESHOLD_MINUTE,
  EARLY_EXIT_THRESHOLD_HOUR,
  EARLY_EXIT_THRESHOLD_MINUTE,
  SHIFT_START_HOUR,
  SHIFT_END_HOUR,
} from "@/lib/attendanceConfig";

export const HALF_DAY_MAX_HOURS = 4.5;

export interface AttendanceMetrics {
  timeIn: Date;
  timeOut: Date;
  isLate: boolean;
  lateMinutes: number;
  earlyExit: boolean;
  /** payable regular hours, lunch deducted, capped at 8 */
  totalHours: number;
  /** raw hours between in and out (no lunch deduction) */
  rawHours: number;
  earlyOT: number;
  eveningOT: number;
  overtimeHours: number;
}

/** Build the two Date objects for a stored date + HH:mm strings. */
export function buildTimes(dateStr: string, timeInStr: string, timeOutStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hIn, miIn] = timeInStr.split(":").map(Number);
  const [hOut, miOut] = timeOutStr.split(":").map(Number);

  const timeIn  = new Date(y, (m || 1) - 1, d || 1, hIn  || 0, miIn  || 0, 0, 0);
  const timeOut = new Date(y, (m || 1) - 1, d || 1, hOut || 0, miOut || 0, 0, 0);

  // checkout before check-in => overnight shift, roll to next day
  if (timeOut.getTime() <= timeIn.getTime()) {
    timeOut.setDate(timeOut.getDate() + 1);
  }
  return { timeIn, timeOut };
}

/** Compute all attendance metrics from two Dates. */
export function computeMetrics(timeIn: Date, timeOut: Date, isHoliday = false): AttendanceMetrics {
  const isSundayShift = timeIn.getDay() === 0;
  const isOffDayShift = isSundayShift || isHoliday;
  const rawHours = Math.max(0, (timeOut.getTime() - timeIn.getTime()) / 3_600_000);

  // ── Sunday or Holiday: every worked hour is OT (minus 1 h unpaid lunch) ──────────────
  if (isOffDayShift) {
    const offDayOT = rawHours > LUNCH_BREAK_HOURS
      ? rawHours - LUNCH_BREAK_HOURS
      : rawHours;
    return {
      timeIn, timeOut,
      isLate: false, lateMinutes: 0, earlyExit: false,
      totalHours: 0, rawHours,
      earlyOT: 0, eveningOT: offDayOT, overtimeHours: offDayOT,
    };
  }

  // ── Night shift: check-in at or after 18:00 ───────────────────────────────
  const isNightShift = timeIn.getHours() >= SHIFT_END_HOUR;
  if (isNightShift) {
    return {
      timeIn, timeOut,
      isLate: false, lateMinutes: 0, earlyExit: false,
      totalHours: 0, rawHours,
      earlyOT: 0, eveningOT: rawHours, overtimeHours: rawHours,
    };
  }

  // ── Regular weekday ───────────────────────────────────────────────────────
  // Deduct 1 h lunch only when they worked more than 1 h total.
  const lunchDed   = rawHours > LUNCH_BREAK_HOURS ? LUNCH_BREAK_HOURS : 0;
  const workedHours = rawHours - lunchDed;
  const totalHours  = Math.min(workedHours, STANDARD_PAYABLE_HOURS);

  // Late detection (login after 09:30 is "late"; minutes counted from 09:00).
  const shiftStartTime = new Date(timeIn);
  shiftStartTime.setHours(SHIFT_START_HOUR, 0, 0, 0);
  const lateThreshold = new Date(timeIn);
  lateThreshold.setHours(LATE_THRESHOLD_HOUR, LATE_THRESHOLD_MINUTE, 0, 0);
  const isLate = timeIn > lateThreshold;
  const lateMinutes = isLate
    ? Math.max(0, Math.floor((timeIn.getTime() - shiftStartTime.getTime()) / 60_000))
    : 0;

  // Early exit: left before 17:30 AND didn't complete 8 h.
  const earlyThreshold = new Date(timeIn);
  earlyThreshold.setHours(EARLY_EXIT_THRESHOLD_HOUR, EARLY_EXIT_THRESHOLD_MINUTE, 0, 0);
  const earlyExit = timeOut < earlyThreshold && workedHours < STANDARD_PAYABLE_HOURS;

  // ── Early OT: time before 09:00 AM ──────────────────────────────────────
  let earlyOT = 0;
  if (timeIn < shiftStartTime) {
    const earlyEnd = timeOut < shiftStartTime ? timeOut : shiftStartTime;
    earlyOT = Math.max(0, (earlyEnd.getTime() - timeIn.getTime()) / 3_600_000);
  }

  // ── Evening OT: excess hours beyond 8 h ─────────────────────────────────
  // Triggered only when total worked > 8 h, so a 10 AM–7 PM worker (= 8 h
  // worked) gets 0 evening OT even though they left after 18:00.
  let eveningOT = 0;
  if (workedHours > STANDARD_PAYABLE_HOURS) {
    eveningOT = Math.max(0, workedHours - earlyOT - STANDARD_PAYABLE_HOURS);
  }

  return {
    timeIn, timeOut,
    isLate, lateMinutes, earlyExit,
    totalHours, rawHours,
    earlyOT, eveningOT,
    overtimeHours: earlyOT + eveningOT,
  };
}

export function metricsFromStrings(dateStr: string, timeInStr: string, timeOutStr: string, isHoliday = false) {
  const { timeIn, timeOut } = buildTimes(dateStr, timeInStr, timeOutStr);
  return computeMetrics(timeIn, timeOut, isHoliday);
}

export type DayStatus =
  | "present"
  | "half_day"
  | "absent"
  | "in_progress"
  | "sunday"
  | "sunday_worked"
  | "holiday"
  | "holiday_worked"
  | "not_joined";

export interface DayCell {
  status: DayStatus;
  hours: number;
  ot: number;
  late: boolean;
  early: boolean;
  timeIn?: string;
  timeOut?: string;
  holidayName?: string;
}

/** Classify a single stored attendance log into a report cell. */
export function classifyLog(
  log: {
    time_in: string;
    time_out: string | null;
    total_hours: number | null;
    overtime_hours: number | null;
    is_late: boolean | null;
    early_exit: boolean | null;
  },
  isHolidayDate = false,
  holidayName?: string
): DayCell {
  const timeIn = new Date(log.time_in);
  const isSunday = timeIn.getDay() === 0;

  if (!log.time_out) {
    return {
      status: "in_progress",
      hours: 0,
      ot: 0,
      late: !isSunday && !isHolidayDate && !!log.is_late,
      early: false,
      timeIn: fmtTime(timeIn),
      holidayName,
    };
  }
  const timeOut = new Date(log.time_out);
  const m = computeMetrics(timeIn, timeOut, isHolidayDate);

  let status: DayStatus = "present";
  if (isSunday) {
    status = "sunday_worked";
  } else if (isHolidayDate) {
    status = "holiday_worked";
  } else if (m.totalHours > 0 && m.totalHours < HALF_DAY_MAX_HOURS) {
    status = "half_day";
  }

  return {
    status,
    hours: round2(m.totalHours),
    ot: round2(m.overtimeHours),
    late: m.isLate,
    early: m.earlyExit,
    timeIn: fmtTime(timeIn),
    timeOut: fmtTime(timeOut),
    holidayName,
  };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/** 7.5 -> "7h 30m" */
export function hoursToHM(hours: number) {
  const h = Math.floor(hours);
  const mn = Math.round((hours - h) * 60);
  if (!h && !mn) return "0m";
  return `${h ? `${h}h ` : ""}${mn}m`.trim();
}

export const STATUS_LABEL: Record<DayStatus, string> = {
  present:        "P",
  half_day:       "HD",
  absent:         "A",
  in_progress:    "IN",
  sunday:         "S",
  sunday_worked:  "SW",
  holiday:        "H",
  holiday_worked: "HW",
  not_joined:     "-",
};

/** Hex colors used for both PDF and Excel so the two exports match. */
export const STATUS_COLORS: Record<DayStatus, { bg: string; text: string }> = {
  present:        { bg: "D1FAE5", text: "047857" },
  half_day:       { bg: "FEF3C7", text: "92400E" },
  absent:         { bg: "FEE2E2", text: "B91C1C" },
  in_progress:    { bg: "DBEAFE", text: "1D4ED8" },
  sunday:         { bg: "F3F4F6", text: "6B7280" },
  sunday_worked:  { bg: "E0E7FF", text: "4338CA" },
  holiday:        { bg: "E0F2FE", text: "0369A1" },
  holiday_worked: { bg: "EDE9FE", text: "6D28D9" },
  not_joined:     { bg: "F9FAFB", text: "9CA3AF" },
};
