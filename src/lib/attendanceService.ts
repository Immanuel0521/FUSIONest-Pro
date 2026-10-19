import { supabase } from "@/lib/supabase";
import {
  LATE_THRESHOLD_HOUR,
  LATE_THRESHOLD_MINUTE,
  EARLY_EXIT_THRESHOLD_HOUR,
  EARLY_EXIT_THRESHOLD_MINUTE,
  EARLY_OT_THRESHOLD_HOUR,
  EARLY_OT_THRESHOLD_MINUTE,
  SHIFT_START_HOUR,
  calculateEarlyOT,
} from "@/lib/attendanceConfig";
import { computeMetrics } from "@/lib/attendanceMetrics";

export type AttendanceSource = 'manual' | 'face_recognition' | 'biometric';

export interface CheckInParams {
  workerId: string;
  supervisorId: string;
  source: AttendanceSource;
  recordedBy?: string;
  timeIn?: Date;
  locationIn?: { lat: number; lng: number; accuracy: number };
  faceVerified?: boolean;
  faceConfidence?: number;
  groupId?: string;
  siteId?: string;
  geofenceVerdict?: string;
  geofenceDistance?: number;
  livenessVerified?: boolean;
  mockLocationFlag?: boolean;
}

export interface CheckOutParams {
  workerId: string;
  source: AttendanceSource;
  recordedBy?: string;
  timeOut?: Date;
  locationOut?: { lat: number; lng: number; accuracy: number };
  faceVerified?: boolean;
  faceConfidence?: number;
  geofenceVerdict?: string;
  geofenceDistance?: number;
  livenessVerified?: boolean;
  mockLocationFlag?: boolean;
}

export interface AttendanceResult {
  status: 'success' | 'already_checked_in' | 'already_checked_out' | 'error' | 'no_checkin';
  attendance_id?: string;
  message: string;
}

/**
 * Unified check-in: ensures one record per worker per date.
 */
export async function unifiedCheckIn(params: CheckInParams): Promise<AttendanceResult> {
  const { 
    workerId, 
    supervisorId, 
    source, 
    recordedBy, 
    timeIn: customTimeIn, 
    locationIn, 
    faceVerified, 
    faceConfidence,
    groupId,
    siteId,
    geofenceVerdict,
    geofenceDistance,
    livenessVerified,
    mockLocationFlag,
  } = params;

  const timeIn = customTimeIn || new Date();
  const dateStr = timeIn.toISOString().split('T')[0];

  // Attendance is unique per worker/day. Query that exact day so an old open
  // shift never blocks today's record and concurrent scans remain safe.
  const { data: existingShift, error: existingError } = await (supabase
    .from('attendance_logs') as any)
    .select('id, time_in, status')
    .eq('worker_id', workerId)
    .eq('date', dateStr)
    .maybeSingle();

  if (existingError) return { status: 'error', message: existingError.message };

  if (existingShift) {
    const existingTime = new Date(existingShift.time_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
      status: 'already_checked_in',
      attendance_id: existingShift.id,
      message: `Worker already has attendance for this day from ${existingTime}`,
    };
  }

  // Calculate late metrics
  const lateThreshold = new Date(timeIn);
  lateThreshold.setHours(LATE_THRESHOLD_HOUR, LATE_THRESHOLD_MINUTE, 0, 0);
  const shiftStart = new Date(timeIn);
  shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);

  const isLate = timeIn > lateThreshold;
  const lateMinutes = isLate
    ? Math.max(0, Math.floor((timeIn.getTime() - shiftStart.getTime()) / (1000 * 60)))
    : 0;

  // Calculate early morning OT (login before 8:50 AM)
  const earlyOT = calculateEarlyOT(timeIn);

  const insertData: any = {
    worker_id: workerId,
    supervisor_id: supervisorId,
    date: dateStr,
    time_in: timeIn.toISOString(),
    is_late: isLate,
    late_minutes: lateMinutes,
    early_exit: false,
    total_hours: 0,
    regular_hours: 0,
    overtime_hours: parseFloat(earlyOT.toFixed(2)), // Store early OT at check-in
    status: 'active',
    checkin_source: source,
    recorded_by: recordedBy || source,
    group_id: groupId,
    site_id: siteId,
  };

  if (locationIn) insertData.location_in = locationIn;
  if (faceVerified) insertData.face_verified_in = true;
  if (faceConfidence) insertData.face_confidence_in = faceConfidence;
  if (geofenceVerdict) insertData.geofence_verdict_in = geofenceVerdict;
  if (geofenceDistance != null) insertData.geofence_distance_in = geofenceDistance;
  if (livenessVerified) insertData.liveness_verified_in = true;
  if (mockLocationFlag) insertData.mock_location_flag = true;

  const { data, error } = await (supabase
    .from('attendance_logs') as any)
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    // Handle unique constraint violation (uq_attendance_worker_date)
    if (error.code === '23505') {
      return {
        status: 'already_checked_in',
        message: 'Worker already has a record for this date',
      };
    }
    return { status: 'error', message: error.message };
  }

  return {
    status: 'success',
    attendance_id: data.id,
    message: `Check-in successful at ${timeIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}${isLate ? ` (Late by ${lateMinutes} min)` : ''}${earlyOT > 0 ? ` (Early OT: ${Math.round(earlyOT * 60)}m)` : ''}`,
  };
}

/**
 * Unified check-out: updates the existing record for the day.
 */
export async function unifiedCheckOut(params: CheckOutParams): Promise<AttendanceResult> {
  const { workerId, source, recordedBy, timeOut: customTimeOut, locationOut, faceVerified, faceConfidence } = params;

  // Find the active (open) shift for this worker, regardless of date (overnight support)
  const { data: existing } = await (supabase
    .from('attendance_logs') as any)
    .select('id, time_in, time_out, status')
    .eq('worker_id', workerId)
    .eq('status', 'active')
    .order('time_in', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    return { status: 'no_checkin', message: 'No active check-in found' };
  }

  if (existing.time_out) {
    const existingTime = new Date(existing.time_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
      status: 'already_checked_out',
      attendance_id: existing.id,
      message: `Worker already checked out at ${existingTime}`,
    };
  }

  const timeIn = new Date(existing.time_in);
  const timeOut = customTimeOut || new Date();

  // Pure datetime math — checkout is whatever Date was provided.
  // If checkout ends up before check-in (manual time-of-day entry crossing midnight), roll forward by 1 day.
  let adjustedTimeOut = timeOut;
  if (adjustedTimeOut.getTime() <= timeIn.getTime()) {
    adjustedTimeOut = new Date(adjustedTimeOut.getTime() + 24 * 60 * 60 * 1000);
  }

  // Compute all metrics via the shared formula (lunch deduction, 18:00 OT boundary, early OT)
  const m = computeMetrics(timeIn, adjustedTimeOut);

  const updateData: any = {
    time_out: adjustedTimeOut.toISOString(),
    early_exit: m.earlyExit,
    total_hours: parseFloat(m.totalHours.toFixed(2)),
    regular_hours: parseFloat(m.totalHours.toFixed(2)),
    // Store full OT (early + evening). Early OT was already stored at check-in
    // but the column holds the latest computed value so it's always consistent.
    overtime_hours: parseFloat(m.overtimeHours.toFixed(2)),
    status: 'completed',
    checkout_source: source,
    recorded_by: recordedBy || source,
  };

  if (locationOut) updateData.location_out = locationOut;
  if (faceVerified) updateData.face_verified_out = true;
  if (faceConfidence) updateData.face_confidence_out = faceConfidence;
  if (params.geofenceVerdict) updateData.geofence_verdict_out = params.geofenceVerdict;
  if (params.geofenceDistance != null) updateData.geofence_distance_out = params.geofenceDistance;
  if (params.livenessVerified) updateData.liveness_verified_out = true;
  if (params.mockLocationFlag) updateData.mock_location_flag = true;

  const { error } = await (supabase
    .from('attendance_logs') as any)
    .update(updateData)
    .eq('id', existing.id);

  if (error) {
    return { status: 'error', message: error.message };
  }

  return {
    status: 'success',
    attendance_id: existing.id,
    message: `Check-out successful. Payable: ${m.totalHours.toFixed(2)}h${m.overtimeHours > 0 ? `, OT: ${m.overtimeHours.toFixed(2)}h` : ''}${m.earlyExit ? ' (Early exit)' : ''}`,
  };
}

/** Source display label */
export function getSourceLabel(source: string | null): string {
  switch (source) {
    case 'face_recognition': return 'Face';
    case 'biometric': return 'Biometric';
    case 'manual': return 'Manual';
    default: return source || 'Manual';
  }
}

/** Source badge color class */
export function getSourceBadgeClass(source: string | null): string {
  switch (source) {
    case 'face_recognition': return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
    case 'biometric': return 'bg-teal-500/20 text-teal-600 dark:text-teal-400';
    case 'manual': return 'bg-amber-500/20 text-amber-600 dark:text-amber-400';
    default: return 'bg-muted text-muted-foreground';
  }
}
