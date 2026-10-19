/**
 * Attendance Audit Logger
 *
 * Provides structured audit logging for all attendance-related events:
 * check-in, check-out, face-match, geofence verdicts, and consent actions.
 *
 * All entries are written to the existing `audit_logs` table via Supabase.
 */

import { supabase } from '@/lib/supabase';

export type AuditAction =
  | 'face_checkin'
  | 'face_checkout'
  | 'face_match_success'
  | 'face_match_failure'
  | 'liveness_passed'
  | 'liveness_failed'
  | 'geofence_on_site'
  | 'geofence_outside_site'
  | 'geofence_unverifiable'
  | 'biometric_consent_granted'
  | 'biometric_consent_revoked'
  | 'face_registration'
  | 'face_data_deleted'
  | 'photo_approved'
  | 'photo_deleted'
  | 'mock_location_detected';

export interface AuditEntry {
  action: AuditAction;
  entityType: 'attendance' | 'worker' | 'biometric' | 'consent' | 'geofence' | 'photo';
  entityId?: string;
  details?: Record<string, unknown>;
}

/**
 * Write an audit log entry.  Silently fails if the user is unauthenticated
 * (public-mode scans) or the DB insert errors — audit logging should never
 * block the main workflow.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // In public mode there may be no authenticated user — still log with a
    // sentinel id so the record is persisted.
    await supabase.from('audit_logs').insert({
      user_id: userId ?? '00000000-0000-0000-0000-000000000000',
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? null,
    });
  } catch (err) {
    // Never throw from audit logging
    console.warn('[audit] Failed to write audit log:', err);
  }
}

/**
 * Convenience: log a face-recognition attendance event.
 */
export async function logFaceAttendance(
  workerId: string,
  attendanceId: string | undefined,
  type: 'in' | 'out',
  confidence: number,
  location?: { lat: number; lng: number; accuracy: number },
  livenessVerified?: boolean,
  geofenceVerdict?: string,
): Promise<void> {
  await writeAuditLog({
    action: type === 'in' ? 'face_checkin' : 'face_checkout',
    entityType: 'attendance',
    entityId: attendanceId,
    details: {
      worker_id: workerId,
      confidence,
      liveness_verified: livenessVerified ?? false,
      geofence_verdict: geofenceVerdict ?? 'unknown',
      location: location ?? null,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Convenience: log a consent action (granted / revoked).
 */
export async function logConsentAction(
  workerId: string | null,
  action: 'biometric_consent_granted' | 'biometric_consent_revoked',
): Promise<void> {
  await writeAuditLog({
    action,
    entityType: 'consent',
    entityId: workerId ?? undefined,
    details: {
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
    },
  });
}
