-- ============================================================================
-- Migration: Fix Face Embeddings Multi-Tenant RLS & Registration Helper
-- Date: 2026-10-19
-- Description:
--   1. Ensures composite unique constraint on (worker_id, angle).
--   2. Replaces restrictive legacy RLS policies on public.face_embeddings so that
--      Super Admins, company members (admin, management, supervisor), and worker
--      supervisors can manage face embeddings without requiring a company_id column on workers.
--   3. Provides a secure SECURITY DEFINER RPC 'register_worker_face_embedding'
--      for atomic biometric registration.
-- ============================================================================

-- 1. Ensure angle column and composite unique constraint exist
ALTER TABLE public.face_embeddings
  ADD COLUMN IF NOT EXISTS angle TEXT DEFAULT 'front';

DO $$
BEGIN
  -- Drop single worker_id unique constraint if still present
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'face_embeddings_worker_id_key'
  ) THEN
    ALTER TABLE public.face_embeddings DROP CONSTRAINT face_embeddings_worker_id_key;
  END IF;

  -- Add composite unique constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_face_embeddings_worker_angle'
  ) THEN
    ALTER TABLE public.face_embeddings
      ADD CONSTRAINT uq_face_embeddings_worker_angle UNIQUE (worker_id, angle);
  END IF;
END $$;

-- 2. Drop existing restrictive policies on face_embeddings
DROP POLICY IF EXISTS "Authenticated users can view face embeddings" ON public.face_embeddings;
DROP POLICY IF EXISTS "Admins and supervisors can manage face embeddings" ON public.face_embeddings;
DROP POLICY IF EXISTS "Only admins and supervisors can view face embeddings" ON public.face_embeddings;
DROP POLICY IF EXISTS "Supervisors can view their workers face data" ON public.face_embeddings;
DROP POLICY IF EXISTS "Company members can view face embeddings" ON public.face_embeddings;
DROP POLICY IF EXISTS "Company members can insert face embeddings" ON public.face_embeddings;
DROP POLICY IF EXISTS "Company members can update face embeddings" ON public.face_embeddings;
DROP POLICY IF EXISTS "Company members can delete face embeddings" ON public.face_embeddings;

-- 3. Unified SELECT Policy (Authenticated users can read embeddings for attendance scanning)
CREATE POLICY "Company members can view face embeddings"
  ON public.face_embeddings FOR SELECT
  TO authenticated
  USING (
    -- Super Admin
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_super_admin = true
    )
    OR
    -- Company admin, management, or supervisor
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'management', 'supervisor')
        AND cm.is_active = true
    )
    OR
    -- Worker's direct supervisor
    EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = face_embeddings.worker_id
        AND w.supervisor_id = auth.uid()
    )
    OR
    -- Legacy user_roles fallback
    (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'supervisor')
    )
  );

-- 4. Unified INSERT Policy
CREATE POLICY "Company members can insert face embeddings"
  ON public.face_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super Admin
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_super_admin = true
    )
    OR
    -- Company admin, management, or supervisor
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'management', 'supervisor')
        AND cm.is_active = true
    )
    OR
    -- Worker's direct supervisor
    EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = worker_id
        AND w.supervisor_id = auth.uid()
    )
    OR
    -- Legacy user_roles fallback
    (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'supervisor')
    )
  );

-- 5. Unified UPDATE Policy
CREATE POLICY "Company members can update face embeddings"
  ON public.face_embeddings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_super_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'management', 'supervisor')
        AND cm.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = face_embeddings.worker_id
        AND w.supervisor_id = auth.uid()
    )
    OR
    (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'supervisor')
    )
  );

-- 6. Unified DELETE Policy
CREATE POLICY "Company members can delete face embeddings"
  ON public.face_embeddings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_super_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'management', 'supervisor')
        AND cm.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = face_embeddings.worker_id
        AND w.supervisor_id = auth.uid()
    )
    OR
    (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'supervisor')
    )
  );

-- 7. Atomic RPC for Registering Face Embeddings
CREATE OR REPLACE FUNCTION public.register_worker_face_embedding(
  p_worker_id UUID,
  p_embedding_data JSONB,
  p_photo_url TEXT DEFAULT NULL,
  p_quality_score NUMERIC DEFAULT 95.0,
  p_angle TEXT DEFAULT 'front'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_authorized BOOLEAN := false;
  v_worker_exists BOOLEAN := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Verify worker exists
  SELECT EXISTS (
    SELECT 1 FROM public.workers WHERE id = p_worker_id
  ) INTO v_worker_exists;

  IF NOT v_worker_exists THEN
    RAISE EXCEPTION 'Worker not found' USING ERRCODE = 'P0002';
  END IF;

  -- Verify caller authorization
  SELECT (
    -- Super Admin
    EXISTS (
      SELECT 1 FROM public.user_profiles WHERE id = v_caller AND is_super_admin = true
    )
    OR
    -- Company admin, management, supervisor
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = v_caller
        AND cm.role IN ('admin', 'management', 'supervisor')
        AND cm.is_active = true
    )
    OR
    -- Worker's supervisor
    EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = p_worker_id AND w.supervisor_id = v_caller
    )
    OR
    -- Legacy user_roles
    (
      public.has_role(v_caller, 'admin') OR
      public.has_role(v_caller, 'supervisor')
    )
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Unauthorized to register face embedding for this worker' USING ERRCODE = '42501';
  END IF;

  -- Upsert embedding atomically
  INSERT INTO public.face_embeddings (
    worker_id,
    embedding_data,
    photo_url,
    quality_score,
    created_by,
    angle,
    updated_at
  )
  VALUES (
    p_worker_id,
    p_embedding_data,
    p_photo_url,
    p_quality_score,
    v_caller,
    COALESCE(p_angle, 'front'),
    now()
  )
  ON CONFLICT (worker_id, angle)
  DO UPDATE SET
    embedding_data = EXCLUDED.embedding_data,
    photo_url = COALESCE(EXCLUDED.photo_url, face_embeddings.photo_url),
    quality_score = EXCLUDED.quality_score,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'worker_id', p_worker_id,
    'angle', COALESCE(p_angle, 'front')
  );
END;
$$;

-- 8. Revoke anon and grant authenticated
REVOKE ALL ON FUNCTION public.register_worker_face_embedding FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_worker_face_embedding TO authenticated;
