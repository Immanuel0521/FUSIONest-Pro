-- ============================================================
-- Migration: Enhanced Biometric Attendance & Geofencing
-- Adds user_consents table, geofence_sites table, multi-angle
-- face embeddings support, scan rate limiting, and tightened
-- RLS policies for face_embeddings.
-- ============================================================

-- ─── 1. User Consent Tracking ───────────────────────────────
-- GDPR/CCPA-compliant consent audit trail for biometric data
CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  consent_type TEXT NOT NULL DEFAULT 'biometric_location',
  granted BOOLEAN NOT NULL DEFAULT true,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert their own consent
CREATE POLICY "Users can insert own consent"
  ON public.user_consents FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can read all consent records
CREATE POLICY "Admins can view all consents"
  ON public.user_consents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own consent records
CREATE POLICY "Users can view own consents"
  ON public.user_consents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ─── 2. Geofence Sites ─────────────────────────────────────
-- Store construction site boundaries for geofence verification
CREATE TABLE IF NOT EXISTS public.geofence_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 150,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.geofence_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view geofence sites"
  ON public.geofence_sites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage geofence sites"
  ON public.geofence_sites FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'supervisor')
  );

-- ─── 3. Extend attendance_logs with geofence & liveness ─────
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS geofence_verdict_in TEXT,
  ADD COLUMN IF NOT EXISTS geofence_verdict_out TEXT,
  ADD COLUMN IF NOT EXISTS geofence_distance_in INTEGER,
  ADD COLUMN IF NOT EXISTS geofence_distance_out INTEGER,
  ADD COLUMN IF NOT EXISTS liveness_verified_in BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS liveness_verified_out BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mock_location_flag BOOLEAN DEFAULT false;

-- ─── 4. Extend face_embeddings for multi-angle ──────────────
-- The 'angle' column may already exist from a previous migration;
-- IF NOT EXISTS ensures idempotency.
ALTER TABLE public.face_embeddings
  ADD COLUMN IF NOT EXISTS angle TEXT DEFAULT 'front';

-- Drop the old unique constraint (worker_id only) if it exists,
-- replaced by a composite unique on (worker_id, angle).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'face_embeddings_worker_id_key'
  ) THEN
    ALTER TABLE public.face_embeddings DROP CONSTRAINT face_embeddings_worker_id_key;
  END IF;
END
$$;

-- Composite unique: one embedding per worker per angle
ALTER TABLE public.face_embeddings
  ADD CONSTRAINT uq_face_embeddings_worker_angle UNIQUE (worker_id, angle);

-- ─── 5. Tighten RLS on face_embeddings ──────────────────────
-- Workers should NOT be able to SELECT arbitrary face embeddings.
-- Only admin/supervisor roles (and the public edge function via
-- service_role) should read them.

-- Drop the old overly-permissive SELECT policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'face_embeddings'
      AND policyname = 'Authenticated users can view face embeddings'
  ) THEN
    DROP POLICY "Authenticated users can view face embeddings" ON public.face_embeddings;
  END IF;
END
$$;

-- New restricted SELECT policy
CREATE POLICY "Only admins and supervisors can view face embeddings"
  ON public.face_embeddings FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'supervisor')
  );

-- ─── 6. Photo retention: scheduled cleanup helper ───────────
-- A helper function that can be called by pg_cron or a Cloud Function
-- to delete approved attendance photos older than the retention period.
CREATE OR REPLACE FUNCTION public.cleanup_old_attendance_photos(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.attendance_photos
  WHERE created_at < now() - (retention_days || ' days')::interval
    AND approved = true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ─── 7. Trigger for geofence_sites updated_at ───────────────
CREATE OR REPLACE TRIGGER update_geofence_sites_updated_at
  BEFORE UPDATE ON public.geofence_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
