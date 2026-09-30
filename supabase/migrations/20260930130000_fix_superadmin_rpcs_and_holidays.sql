-- ============================================================
-- FIX SUPER ADMIN RPCS + COMPANY HOLIDAYS SYSTEM
-- ============================================================

-- 1. Fix get_all_companies_superadmin (Resolves ambiguous column "id" error)
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
  GROUP BY c.id
  ORDER BY c.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_companies_superadmin() TO authenticated, anon;

-- 2. Fix get_all_users_superadmin (Resolves ambiguous column "is_super_admin" error)
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

GRANT EXECUTE ON FUNCTION public.get_all_users_superadmin() TO authenticated, anon;

-- 3. Super admin RLS policies on companies for direct access fallback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Super admin can view all companies'
  ) THEN
    CREATE POLICY "Super admin can view all companies"
      ON public.companies FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_super_admin = true)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Super admin can update all companies'
  ) THEN
    CREATE POLICY "Super admin can update all companies"
      ON public.companies FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_super_admin = true)
      );
  END IF;
END $$;

-- 4. Company Holidays Table
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, holiday_date)
);

ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_holidays' AND policyname = 'Company members can view holidays'
  ) THEN
    CREATE POLICY "Company members can view holidays"
      ON public.company_holidays FOR SELECT
      USING (
        company_id IN (
          SELECT company_id FROM public.company_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_holidays' AND policyname = 'Admins can manage company holidays'
  ) THEN
    CREATE POLICY "Admins can manage company holidays"
      ON public.company_holidays FOR ALL
      USING (
        company_id IN (
          SELECT company_id FROM public.company_members
          WHERE user_id = auth.uid() AND role IN ('admin', 'management') AND is_active = true
        )
      )
      WITH CHECK (
        company_id IN (
          SELECT company_id FROM public.company_members
          WHERE user_id = auth.uid() AND role IN ('admin', 'management') AND is_active = true
        )
      );
  END IF;
END $$;

GRANT ALL ON public.company_holidays TO authenticated, anon;
