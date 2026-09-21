-- ============================================================
-- Phase 1 – Company Setup & Authentication
-- ============================================================

-- ── companies ──────────────────────────────────────────────
CREATE TABLE public.companies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  company_code  TEXT        UNIQUE NOT NULL,   -- e.g. "FUS-A1B2C3"
  join_code     TEXT        UNIQUE NOT NULL,   -- 6-digit numeric e.g. "482931"
  logo_url      TEXT,
  industry      TEXT,
  address       TEXT,
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── company_members ─────────────────────────────────────────
CREATE TABLE public.company_members (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  role        TEXT    NOT NULL CHECK (role IN ('admin','management','supervisor','worker')),
  is_active   BOOLEAN DEFAULT true,
  joined_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- ── user_profiles ───────────────────────────────────────────
CREATE TABLE public.user_profiles (
  id                UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         TEXT,
  phone             TEXT,
  avatar_url        TEXT,
  active_company_id UUID    REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ── helper: generate unique company code ───────────────────
CREATE OR REPLACE FUNCTION public.gen_company_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  TEXT;
  done  BOOLEAN := false;
BEGIN
  WHILE NOT done LOOP
    code := 'FUS-';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    done := NOT EXISTS (SELECT 1 FROM public.companies WHERE company_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- ── helper: generate unique 6-digit join code ──────────────
CREATE OR REPLACE FUNCTION public.gen_join_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
  done BOOLEAN := false;
BEGIN
  WHILE NOT done LOOP
    code := lpad(floor(random() * 900000 + 100000)::TEXT, 6, '0');
    done := NOT EXISTS (SELECT 1 FROM public.companies WHERE join_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- ── RPC: look up a company by join code (bypasses RLS) ─────
CREATE OR REPLACE FUNCTION public.get_company_by_join_code(p_join_code TEXT)
RETURNS TABLE (
  id UUID, name TEXT, company_code TEXT, join_code TEXT,
  logo_url TEXT, industry TEXT, address TEXT, member_count BIGINT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id, c.name, c.company_code, c.join_code,
    c.logo_url, c.industry, c.address,
    COUNT(cm.id) AS member_count
  FROM public.companies c
  LEFT JOIN public.company_members cm ON cm.company_id = c.id AND cm.is_active = true
  WHERE c.join_code = p_join_code
  GROUP BY c.id;
$$;

-- ── auto-create user_profile on new signup ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── timestamps ─────────────────────────────────────────────
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;

-- companies
CREATE POLICY "Members can view their company"
  ON public.companies FOR SELECT
  USING (id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Authenticated can insert company"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Admins can update company"
  ON public.companies FOR UPDATE
  USING (id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true));

CREATE POLICY "Admins can delete company"
  ON public.companies FOR DELETE
  USING (id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true));

-- company_members
CREATE POLICY "Members see own memberships + admins see all in company"
  ON public.company_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('admin','management') AND is_active = true
    )
  );

CREATE POLICY "Authenticated can join (insert own row)"
  ON public.company_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update member roles"
  ON public.company_members FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
  ));

CREATE POLICY "Admins can remove members"
  ON public.company_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- user_profiles
CREATE POLICY "Own profile full access"
  ON public.user_profiles FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Company members can read profiles"
  ON public.user_profiles FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id FROM public.company_members
      WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND is_active = true
      ) AND is_active = true
    )
  );

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX idx_company_members_user     ON public.company_members(user_id);
CREATE INDEX idx_company_members_company  ON public.company_members(company_id);
CREATE INDEX idx_companies_join_code      ON public.companies(join_code);
CREATE INDEX idx_companies_company_code   ON public.companies(company_code);
CREATE INDEX idx_user_profiles_phone      ON public.user_profiles(phone);
