-- ============================================================
-- FUSIONest Pro: Security Hardening & Super Admin RPC Remediation
-- Migration: 20261013180000_harden_security_and_superadmin_rpcs.sql
-- Description:
--   1. Fix user_profiles privilege escalation (CWE-269) via strict trigger.
--   2. Install missing Super Admin RPCs with input validation & least privilege.
--   3. Implement safe reversible soft deletion and restore mechanisms for companies.
--   4. Drop and recreate get_all_users_superadmin to prevent signature conflicts.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PRIVILEGE ESCALATION PROTECTION ON user_profiles
-- ────────────────────────────────────────────────────────────

-- Ensure administrative columns exist on user_profiles
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_companies_allowed INTEGER DEFAULT 5;

-- Ensure columns exist on companies
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Trigger Function: Blocks unauthorized changes to is_super_admin and max_companies_allowed
CREATE OR REPLACE FUNCTION public.protect_user_profile_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_super BOOLEAN := false;
BEGIN
  -- Determine whether caller is trusted or a verified super admin
  IF auth.jwt() IS NOT NULL THEN
    -- Request is arriving via Supabase HTTP API (PostgREST)
    IF (auth.jwt()->>'role') = 'service_role' THEN
      v_caller_is_super := true;
    ELSIF auth.uid() IS NOT NULL THEN
      SELECT COALESCE(is_super_admin, false) INTO v_caller_is_super
      FROM public.user_profiles
      WHERE id = auth.uid();
    ELSE
      -- Anonymous request (role = 'anon' or unauthenticated): strictly untrusted
      v_caller_is_super := false;
    END IF;
  ELSE
    -- Direct database session (psql, Supabase SQL Editor, backend migrations)
    v_caller_is_super := true;
  END IF;

  -- 1. Handle INSERT: prevent non-super-admins from injecting super admin status
  IF TG_OP = 'INSERT' THEN
    IF NOT v_caller_is_super THEN
      NEW.is_super_admin := false;
      NEW.max_companies_allowed := 5;
    END IF;
    RETURN NEW;
  END IF;

  -- 2. Handle UPDATE: strictly abort unauthorized privilege changes
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin) OR
       (NEW.max_companies_allowed IS DISTINCT FROM OLD.max_companies_allowed) THEN
      IF NOT v_caller_is_super THEN
        RAISE EXCEPTION 'Privilege escalation rejected: only verified Super Admins can alter administrative flags (is_super_admin, max_companies_allowed).';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Safely recreate the trigger
DROP TRIGGER IF EXISTS trg_protect_user_profile_privileged_fields ON public.user_profiles;
CREATE TRIGGER trg_protect_user_profile_privileged_fields
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_profile_privileged_fields();


-- ────────────────────────────────────────────────────────────
-- 2. SUPER ADMIN MANAGEMENT RPCS
-- ────────────────────────────────────────────────────────────

-- RPC 1: toggle_company_access
CREATE OR REPLACE FUNCTION public.toggle_company_access(
  p_company_id UUID,
  p_is_active BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict Super Admin verification
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  -- Validate company existence
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'Company with ID % not found', p_company_id;
  END IF;

  UPDATE public.companies
  SET 
    is_active = p_is_active,
    suspended_reason = CASE 
      WHEN p_is_active = true THEN NULL 
      ELSE coalesce(p_reason, 'Access suspended by website administrator') 
    END,
    updated_at = now()
  WHERE id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_company_access(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_company_access(UUID, BOOLEAN, TEXT) TO authenticated;


-- RPC 2: admin_update_company_by_superadmin
CREATE OR REPLACE FUNCTION public.admin_update_company_by_superadmin(
  p_company_id UUID,
  p_name TEXT,
  p_industry TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict Super Admin verification
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  -- Input validation
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Company name cannot be blank';
  END IF;

  UPDATE public.companies
  SET
    name = trim(p_name),
    industry = nullif(trim(p_industry), ''),
    address = nullif(trim(p_address), ''),
    is_active = p_is_active,
    suspended_reason = CASE WHEN p_is_active = true THEN NULL ELSE p_reason END,
    updated_at = now()
  WHERE id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_company_by_superadmin(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_company_by_superadmin(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;


-- RPC 3: set_user_company_quota
CREATE OR REPLACE FUNCTION public.set_user_company_quota(
  p_user_id UUID,
  p_quota INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict Super Admin verification
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  -- Input validation (Enforces reasonable range 1 - 1000)
  IF p_quota IS NULL OR p_quota < 1 OR p_quota > 1000 THEN
    RAISE EXCEPTION 'Company quota must be between 1 and 1000 (received %)', p_quota;
  END IF;

  UPDATE public.user_profiles
  SET 
    max_companies_allowed = p_quota,
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile % not found', p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_company_quota(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_company_quota(UUID, INTEGER) TO authenticated;


-- RPC 4: delete_company_superadmin (Safe Reversible Soft Deletion)
CREATE OR REPLACE FUNCTION public.delete_company_superadmin(
  p_company_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict Super Admin verification
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  -- Mark as soft-deleted and deactivate to preserve audit logs and membership history
  UPDATE public.companies
  SET 
    is_active = false,
    deleted_at = now(),
    suspended_reason = 'Company archived and deleted by Super Admin at ' || now()::TEXT,
    updated_at = now()
  WHERE id = p_company_id;

  -- Deactivate active memberships for this company so users are prompted to switch or onboard
  UPDATE public.company_members
  SET is_active = false
  WHERE company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_company_superadmin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_company_superadmin(UUID) TO authenticated;


-- RPC 5: restore_company_superadmin (Restores Soft-Deleted Company)
CREATE OR REPLACE FUNCTION public.restore_company_superadmin(
  p_company_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  UPDATE public.companies
  SET 
    is_active = true,
    deleted_at = NULL,
    suspended_reason = NULL,
    updated_at = now()
  WHERE id = p_company_id;

  -- Re-activate company members
  UPDATE public.company_members
  SET is_active = true
  WHERE company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_company_superadmin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_company_superadmin(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. DROP & RECREATE QUERY RPCS TO PREVENT RETURN TYPE CONFLICTS
-- ────────────────────────────────────────────────────────────

-- Safe drop before recreation
DROP FUNCTION IF EXISTS public.get_all_users_superadmin();

CREATE OR REPLACE FUNCTION public.get_all_users_superadmin()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  photo_url TEXT,
  is_super_admin BOOLEAN,
  max_companies_allowed INT,
  created_at TIMESTAMPTZ,
  company_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles AS up_chk
    WHERE up_chk.id = auth.uid() AND up_chk.is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  RETURN QUERY
  SELECT
    up.id AS user_id,
    up.full_name,
    au.email::TEXT,
    up.photo_url,
    COALESCE(up.is_super_admin, false) AS is_super_admin,
    COALESCE(up.max_companies_allowed, 5)::INT AS max_companies_allowed,
    au.created_at,
    COUNT(DISTINCT cm.company_id) AS company_count
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.id = au.id
  LEFT JOIN public.company_members cm ON cm.user_id = au.id AND cm.is_active = true
  GROUP BY up.id, up.full_name, au.email, up.photo_url, up.is_super_admin, up.max_companies_allowed, au.created_at
  ORDER BY au.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_all_users_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_users_superadmin() TO authenticated;


-- Safe drop before recreation
DROP FUNCTION IF EXISTS public.get_all_companies_superadmin();

CREATE OR REPLACE FUNCTION public.get_all_companies_superadmin()
RETURNS TABLE (
  id UUID,
  name TEXT,
  company_code TEXT,
  industry TEXT,
  address TEXT,
  logo_url TEXT,
  is_active BOOLEAN,
  suspended_reason TEXT,
  created_at TIMESTAMPTZ,
  member_count BIGINT,
  admin_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles AS up_chk
    WHERE up_chk.id = auth.uid() AND up_chk.is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.company_code,
    c.industry,
    c.address,
    c.logo_url,
    c.is_active,
    c.suspended_reason,
    c.created_at,
    COUNT(cm.id) AS member_count,
    (SELECT au.email::TEXT FROM auth.users au WHERE au.id = c.created_by) AS admin_email
  FROM public.companies c
  LEFT JOIN public.company_members cm ON cm.company_id = c.id AND cm.is_active = true
  WHERE c.deleted_at IS NULL
  GROUP BY c.id
  ORDER BY c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_all_companies_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_companies_superadmin() TO authenticated;
