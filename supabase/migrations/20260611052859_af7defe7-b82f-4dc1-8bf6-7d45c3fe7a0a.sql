-- 1. SITES
CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sites_admin_mgmt_all" ON public.sites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY "sites_supervisor_read" ON public.sites FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'supervisor'));
CREATE TRIGGER trg_sites_updated BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_sites_project ON public.sites(project_id);

-- 2. WORKER GROUPS
CREATE TABLE public.worker_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  trade text,
  supervisor_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_groups TO authenticated;
GRANT ALL ON public.worker_groups TO service_role;
ALTER TABLE public.worker_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wg_admin_mgmt_all" ON public.worker_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY "wg_supervisor_read" ON public.worker_groups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "wg_supervisor_own_update" ON public.worker_groups FOR UPDATE TO authenticated
  USING (supervisor_id = auth.uid()) WITH CHECK (supervisor_id = auth.uid());
CREATE TRIGGER trg_wg_updated BEFORE UPDATE ON public.worker_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wg_site ON public.worker_groups(site_id);

-- 3. GROUP MEMBERS (one active group per worker)
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.worker_groups(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_group_members_active ON public.group_members(worker_id) WHERE active = true;
CREATE INDEX idx_gm_group ON public.group_members(group_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_admin_mgmt_all" ON public.group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY "gm_supervisor_read" ON public.group_members FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "gm_supervisor_manage_own" ON public.group_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.worker_groups g WHERE g.id = group_members.group_id AND g.supervisor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.worker_groups g WHERE g.id = group_members.group_id AND g.supervisor_id = auth.uid()));

-- 4. WORKER TRANSFERS (append-only history)
CREATE TABLE public.worker_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  from_group_id uuid REFERENCES public.worker_groups(id),
  to_group_id uuid REFERENCES public.worker_groups(id),
  transferred_at timestamptz NOT NULL DEFAULT now(),
  transferred_by uuid REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.worker_transfers TO authenticated;
GRANT ALL ON public.worker_transfers TO service_role;
ALTER TABLE public.worker_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wt_read_all_auth" ON public.worker_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "wt_insert_admin_mgmt_sup" ON public.worker_transfers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management') OR public.has_role(auth.uid(),'supervisor'));
CREATE INDEX idx_wt_worker ON public.worker_transfers(worker_id);

-- 5. DEPLOYMENTS
CREATE TABLE public.deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.worker_groups(id) ON DELETE CASCADE,
  deployment_date date NOT NULL DEFAULT CURRENT_DATE,
  worker_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deployments TO authenticated;
GRANT ALL ON public.deployments TO service_role;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dep_read_auth" ON public.deployments FOR SELECT TO authenticated USING (true);
CREATE POLICY "dep_write_admin_mgmt_sup" ON public.deployments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management') OR public.has_role(auth.uid(),'supervisor'));
CREATE TRIGGER trg_dep_updated BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_dep_date ON public.deployments(deployment_date);
CREATE INDEX idx_dep_group ON public.deployments(group_id);

-- 6. ATTENDANCE AUDIT LOGS
CREATE TABLE public.attendance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id uuid REFERENCES public.attendance_logs(id) ON DELETE SET NULL,
  worker_id uuid REFERENCES public.workers(id),
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.attendance_audit_logs TO authenticated;
GRANT ALL ON public.attendance_audit_logs TO service_role;
ALTER TABLE public.attendance_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aal_read_admin_mgmt" ON public.attendance_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY "aal_insert_auth" ON public.attendance_audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- 7. HOLIDAYS
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hol_read_auth" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "hol_write_admin_mgmt" ON public.holidays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

-- 8. EXTEND attendance_logs
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id),
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.worker_groups(id),
  ADD COLUMN IF NOT EXISTS notes_in text,
  ADD COLUMN IF NOT EXISTS notes_out text,
  ADD COLUMN IF NOT EXISTS marked_by uuid REFERENCES auth.users(id);

-- Unique (worker_id, date) for duplicate prevention across all sources
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_worker_date
  ON public.attendance_logs(worker_id, date);

-- 9. EXTEND workers with current assignment
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS current_site_id uuid REFERENCES public.sites(id),
  ADD COLUMN IF NOT EXISTS current_group_id uuid REFERENCES public.worker_groups(id);

-- 10. Helper: transfer worker (single active membership + history)
CREATE OR REPLACE FUNCTION public.transfer_worker_to_group(
  p_worker_id uuid,
  p_to_group_id uuid,
  p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_group uuid;
  v_site uuid;
  v_transfer_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management') OR public.has_role(auth.uid(),'supervisor')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT group_id INTO v_from_group
  FROM public.group_members
  WHERE worker_id = p_worker_id AND active = true
  LIMIT 1;

  -- deactivate existing
  UPDATE public.group_members SET active = false
  WHERE worker_id = p_worker_id AND active = true;

  -- add new
  INSERT INTO public.group_members(group_id, worker_id, assigned_by, active)
  VALUES (p_to_group_id, p_worker_id, auth.uid(), true);

  -- history
  INSERT INTO public.worker_transfers(worker_id, from_group_id, to_group_id, transferred_by, reason)
  VALUES (p_worker_id, v_from_group, p_to_group_id, auth.uid(), p_reason)
  RETURNING id INTO v_transfer_id;

  -- cache on worker
  SELECT site_id INTO v_site FROM public.worker_groups WHERE id = p_to_group_id;
  UPDATE public.workers SET current_group_id = p_to_group_id, current_site_id = v_site
  WHERE id = p_worker_id;

  RETURN v_transfer_id;
END;
$$;