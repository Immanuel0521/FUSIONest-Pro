
DO $$ BEGIN CREATE TYPE public.dpr_status AS ENUM ('not_started','draft','submitted','under_review','approved','returned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dpr_readiness AS ENUM ('ready','at_risk','blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dpr_activity_status AS ENUM ('completed','partial','not_started'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.material_alert_status AS ENUM ('open','procuring','fulfilled','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- materials master
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  unit text NOT NULL,
  category text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_read_auth" ON public.materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "materials_admin_write" ON public.materials FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER materials_updated_at BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.project_material_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  current_stock numeric(14,3) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, material_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_material_stock TO authenticated;
GRANT ALL ON public.project_material_stock TO service_role;
ALTER TABLE public.project_material_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pms_read" ON public.project_material_stock FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management')
  OR has_role(auth.uid(),'project_manager') OR has_role(auth.uid(),'procurement')
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.supervisor_id = auth.uid())
);
CREATE POLICY "pms_write" ON public.project_material_stock FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.supervisor_id = auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.supervisor_id = auth.uid()));

CREATE TABLE public.activity_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_type_id uuid NOT NULL REFERENCES public.activity_types(id) ON DELETE CASCADE,
  prerequisite_activity_type_id uuid NOT NULL REFERENCES public.activity_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, activity_type_id, prerequisite_activity_type_id)
);
GRANT SELECT ON public.activity_dependencies TO authenticated;
GRANT ALL ON public.activity_dependencies TO service_role;
ALTER TABLE public.activity_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "actdep_read" ON public.activity_dependencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "actdep_admin_write" ON public.activity_dependencies FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.dpr_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  first_reminder_time time NOT NULL DEFAULT '17:30',
  second_reminder_time time NOT NULL DEFAULT '18:30',
  cutoff_time time NOT NULL DEFAULT '19:30',
  working_days int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dpr_config TO authenticated;
GRANT ALL ON public.dpr_config TO service_role;
ALTER TABLE public.dpr_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_config_read" ON public.dpr_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "dpr_config_admin_write" ON public.dpr_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
INSERT INTO public.dpr_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_code text,
  ADD COLUMN IF NOT EXISTS project_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE public.dpr_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dpr_number text NOT NULL,
  report_date date NOT NULL,
  site_engineer_id uuid NOT NULL REFERENCES auth.users(id),
  pm_id uuid REFERENCES auth.users(id),
  status public.dpr_status NOT NULL DEFAULT 'draft',
  readiness public.dpr_readiness,
  readiness_reason text,
  pm_instruction text,
  returned_reason text,
  confirm_accuracy boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  approved_at timestamptz,
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, report_date)
);
CREATE INDEX idx_dpr_reports_project_date ON public.dpr_reports(project_id, report_date DESC);
CREATE INDEX idx_dpr_reports_engineer ON public.dpr_reports(site_engineer_id);
CREATE INDEX idx_dpr_reports_status ON public.dpr_reports(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpr_reports TO authenticated;
GRANT ALL ON public.dpr_reports TO service_role;
ALTER TABLE public.dpr_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_read" ON public.dpr_reports FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management')
  OR site_engineer_id = auth.uid() OR pm_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.supervisor_id = auth.uid() OR p.project_manager_id = auth.uid()))
);
CREATE POLICY "dpr_engineer_insert" ON public.dpr_reports FOR INSERT TO authenticated
  WITH CHECK (
    site_engineer_id = auth.uid()
    AND (has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.supervisor_id = auth.uid()))
  );
CREATE POLICY "dpr_update" ON public.dpr_reports FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'admin')
    OR (site_engineer_id = auth.uid() AND status IN ('draft','returned'))
    OR pm_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.project_manager_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(),'admin')
    OR site_engineer_id = auth.uid()
    OR pm_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.project_manager_id = auth.uid())
  );
CREATE POLICY "dpr_admin_delete" ON public.dpr_reports FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER dpr_reports_updated_at BEFORE UPDATE ON public.dpr_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.next_dpr_number(_project_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text; v_seq int;
BEGIN
  SELECT COALESCE(NULLIF(project_code,''), 'P' || substr(id::text,1,4)) INTO v_code FROM public.projects WHERE id = _project_id;
  SELECT COUNT(*) + 1 INTO v_seq FROM public.dpr_reports WHERE project_id = _project_id;
  RETURN v_code || '-DPR-' || lpad(v_seq::text, 3, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.can_access_dpr(_dpr_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dpr_reports d
    LEFT JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = _dpr_id AND (
      has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management')
      OR d.site_engineer_id = auth.uid() OR d.pm_id = auth.uid()
      OR p.supervisor_id = auth.uid() OR p.project_manager_id = auth.uid()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_dpr(_dpr_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dpr_reports d
    WHERE d.id = _dpr_id AND (
      has_role(auth.uid(),'admin')
      OR (d.site_engineer_id = auth.uid() AND d.status IN ('draft','returned'))
    )
  );
$$;

CREATE TABLE public.dpr_manpower (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id uuid NOT NULL REFERENCES public.dpr_reports(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  worker_name text, trade text,
  present boolean NOT NULL DEFAULT true,
  work_area text, activity_assigned text,
  regular_hours numeric(5,2) NOT NULL DEFAULT 0,
  ot_hours numeric(5,2) NOT NULL DEFAULT 0,
  remarks text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dpr_manpower(dpr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpr_manpower TO authenticated;
GRANT ALL ON public.dpr_manpower TO service_role;
ALTER TABLE public.dpr_manpower ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_mp_read" ON public.dpr_manpower FOR SELECT TO authenticated USING (can_access_dpr(dpr_id));
CREATE POLICY "dpr_mp_write" ON public.dpr_manpower FOR ALL TO authenticated
  USING (can_edit_dpr(dpr_id)) WITH CHECK (can_edit_dpr(dpr_id));

CREATE TABLE public.dpr_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id uuid NOT NULL REFERENCES public.dpr_reports(id) ON DELETE CASCADE,
  activity_type_id uuid REFERENCES public.activity_types(id),
  activity_name text, location text,
  planned_qty numeric(14,3) NOT NULL DEFAULT 0,
  completed_qty numeric(14,3) NOT NULL DEFAULT 0,
  unit text,
  status public.dpr_activity_status NOT NULL DEFAULT 'partial',
  remarks text,
  cumulative_before numeric(14,3) DEFAULT 0,
  cumulative_after numeric(14,3) DEFAULT 0,
  total_project_qty numeric(14,3),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dpr_activities(dpr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpr_activities TO authenticated;
GRANT ALL ON public.dpr_activities TO service_role;
ALTER TABLE public.dpr_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_act_read" ON public.dpr_activities FOR SELECT TO authenticated USING (can_access_dpr(dpr_id));
CREATE POLICY "dpr_act_write" ON public.dpr_activities FOR ALL TO authenticated
  USING (can_edit_dpr(dpr_id)) WITH CHECK (can_edit_dpr(dpr_id));

CREATE TABLE public.dpr_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id uuid NOT NULL REFERENCES public.dpr_reports(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id),
  material_name text, unit text,
  opening_stock numeric(14,3) NOT NULL DEFAULT 0,
  received_today numeric(14,3) NOT NULL DEFAULT 0,
  used_today numeric(14,3) NOT NULL DEFAULT 0,
  wastage_qty numeric(14,3) NOT NULL DEFAULT 0,
  wastage_reason text, wastage_photo text,
  closing_stock numeric(14,3) GENERATED ALWAYS AS (opening_stock + received_today - used_today - wastage_qty) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dpr_materials(dpr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpr_materials TO authenticated;
GRANT ALL ON public.dpr_materials TO service_role;
ALTER TABLE public.dpr_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_mat_read" ON public.dpr_materials FOR SELECT TO authenticated USING (can_access_dpr(dpr_id));
CREATE POLICY "dpr_mat_write" ON public.dpr_materials FOR ALL TO authenticated
  USING (can_edit_dpr(dpr_id)) WITH CHECK (can_edit_dpr(dpr_id));

CREATE TABLE public.dpr_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id uuid NOT NULL REFERENCES public.dpr_reports(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL,
  impact text, responsible_person text, action_required text,
  resolution_date date, affects_tomorrow boolean NOT NULL DEFAULT false,
  photo_url text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dpr_issues(dpr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpr_issues TO authenticated;
GRANT ALL ON public.dpr_issues TO service_role;
ALTER TABLE public.dpr_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_iss_read" ON public.dpr_issues FOR SELECT TO authenticated USING (can_access_dpr(dpr_id));
CREATE POLICY "dpr_iss_write" ON public.dpr_issues FOR ALL TO authenticated
  USING (can_edit_dpr(dpr_id)) WITH CHECK (can_edit_dpr(dpr_id));

CREATE TABLE public.dpr_qc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id uuid NOT NULL REFERENCES public.dpr_reports(id) ON DELETE CASCADE,
  activity_inspected text, area text,
  status text NOT NULL,
  defect text, corrective_action text, responsible_person text,
  target_date date, photo_url text,
  checklist_response_id uuid REFERENCES public.checklist_responses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dpr_qc(dpr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpr_qc TO authenticated;
GRANT ALL ON public.dpr_qc TO service_role;
ALTER TABLE public.dpr_qc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_qc_read" ON public.dpr_qc FOR SELECT TO authenticated USING (can_access_dpr(dpr_id));
CREATE POLICY "dpr_qc_write" ON public.dpr_qc FOR ALL TO authenticated
  USING (can_edit_dpr(dpr_id)) WITH CHECK (can_edit_dpr(dpr_id));

CREATE TABLE public.dpr_safety (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id uuid NOT NULL REFERENCES public.dpr_reports(id) ON DELETE CASCADE,
  ppe_ok boolean NOT NULL DEFAULT true,
  unsafe_condition boolean NOT NULL DEFAULT false,
  incident boolean NOT NULL DEFAULT false,
  near_miss boolean NOT NULL DEFAULT false,
  description text, action_taken text, responsible_person text, photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dpr_safety(dpr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpr_safety TO authenticated;
GRANT ALL ON public.dpr_safety TO service_role;
ALTER TABLE public.dpr_safety ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_saf_read" ON public.dpr_safety FOR SELECT TO authenticated USING (can_access_dpr(dpr_id));
CREATE POLICY "dpr_saf_write" ON public.dpr_safety FOR ALL TO authenticated
  USING (can_edit_dpr(dpr_id)) WITH CHECK (can_edit_dpr(dpr_id));

CREATE TABLE public.dpr_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id uuid NOT NULL REFERENCES public.dpr_reports(id) ON DELETE CASCADE,
  category text NOT NULL, photo_url text NOT NULL,
  area text, uploaded_by uuid REFERENCES auth.users(id),
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dpr_photos(dpr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpr_photos TO authenticated;
GRANT ALL ON public.dpr_photos TO service_role;
ALTER TABLE public.dpr_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_ph_read" ON public.dpr_photos FOR SELECT TO authenticated USING (can_access_dpr(dpr_id));
CREATE POLICY "dpr_ph_write" ON public.dpr_photos FOR ALL TO authenticated
  USING (can_edit_dpr(dpr_id)) WITH CHECK (can_edit_dpr(dpr_id));

CREATE TABLE public.dpr_tomorrow_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id uuid NOT NULL REFERENCES public.dpr_reports(id) ON DELETE CASCADE,
  activity_type_id uuid REFERENCES public.activity_types(id),
  activity_name text, area text,
  target_qty numeric(14,3), unit text,
  workers_required int, trade_required text,
  expected_duration_hrs numeric(5,2), tools_required text,
  remarks text, prerequisite_ok boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dpr_tomorrow_activities(dpr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpr_tomorrow_activities TO authenticated;
GRANT ALL ON public.dpr_tomorrow_activities TO service_role;
ALTER TABLE public.dpr_tomorrow_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_tact_read" ON public.dpr_tomorrow_activities FOR SELECT TO authenticated USING (can_access_dpr(dpr_id));
CREATE POLICY "dpr_tact_write" ON public.dpr_tomorrow_activities FOR ALL TO authenticated
  USING (can_edit_dpr(dpr_id)) WITH CHECK (can_edit_dpr(dpr_id));

CREATE TABLE public.material_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dpr_id uuid REFERENCES public.dpr_reports(id) ON DELETE SET NULL,
  material_id uuid REFERENCES public.materials(id),
  material_name text,
  required_qty numeric(14,3) NOT NULL,
  available_qty numeric(14,3) NOT NULL DEFAULT 0,
  shortfall numeric(14,3) NOT NULL,
  required_date date, priority text NOT NULL DEFAULT 'normal',
  status public.material_alert_status NOT NULL DEFAULT 'open',
  requested_by uuid REFERENCES auth.users(id),
  fulfilled_at timestamptz, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.material_alerts(project_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_alerts TO authenticated;
GRANT ALL ON public.material_alerts TO service_role;
ALTER TABLE public.material_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "malert_read" ON public.material_alerts FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management')
  OR has_role(auth.uid(),'procurement') OR has_role(auth.uid(),'project_manager')
  OR requested_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.supervisor_id = auth.uid() OR p.project_manager_id = auth.uid()))
);
CREATE POLICY "malert_write" ON public.material_alerts FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement')
    OR requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.supervisor_id = auth.uid() OR p.project_manager_id = auth.uid()))
  ) WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement')
    OR requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.supervisor_id = auth.uid() OR p.project_manager_id = auth.uid()))
  );
CREATE TRIGGER material_alerts_updated_at BEFORE UPDATE ON public.material_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dpr_tomorrow_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id uuid NOT NULL REFERENCES public.dpr_reports(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id),
  material_name text, unit text,
  required_qty numeric(14,3) NOT NULL DEFAULT 0,
  available_qty numeric(14,3) NOT NULL DEFAULT 0,
  shortfall numeric(14,3) GENERATED ALWAYS AS (GREATEST(required_qty - available_qty, 0)) STORED,
  alert_id uuid REFERENCES public.material_alerts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dpr_tomorrow_materials(dpr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpr_tomorrow_materials TO authenticated;
GRANT ALL ON public.dpr_tomorrow_materials TO service_role;
ALTER TABLE public.dpr_tomorrow_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_tmat_read" ON public.dpr_tomorrow_materials FOR SELECT TO authenticated USING (can_access_dpr(dpr_id));
CREATE POLICY "dpr_tmat_write" ON public.dpr_tomorrow_materials FOR ALL TO authenticated
  USING (can_edit_dpr(dpr_id)) WITH CHECK (can_edit_dpr(dpr_id));

-- Seed FUSIONest activities
INSERT INTO public.activity_types (name, description, display_order) VALUES
  ('MS Fabrication','Metal structure fabrication',10),
  ('MS Structure Erection','Erection of MS structures',20),
  ('GI Channel Fabrication','Galvanized iron channel fab',30),
  ('GI Frame Assembly','GI frame assembly',40),
  ('Internal Vapour/Moisture Membrane','Internal membrane',50),
  ('Internal Board Fixing','Fixing internal boards',60),
  ('Electrical Rough-In','Electrical conduits + wiring rough',70),
  ('Plumbing Rough-In','Plumbing rough-in',80),
  ('Plumbing Pressure Testing','Pressure test',90),
  ('Rockwool Insulation','Rockwool install',100),
  ('External Vapour Barrier','External vapour barrier',110),
  ('External Board Fixing','External boards',120),
  ('Joint Treatment','Board joint treatment',130),
  ('Waterproofing','Waterproofing',140),
  ('Internal Putty','Internal putty',150),
  ('Primer','Primer coat',160),
  ('Internal Painting','Internal paint',170),
  ('External Texture','External texture',180),
  ('External Primer','External primer',190),
  ('External Painting','External paint',200),
  ('Roofing','Roofing works',210),
  ('Flooring','Flooring',220),
  ('Tiles','Tile work',230),
  ('Doors','Door installation',240),
  ('Windows','Window installation',250),
  ('Sanitary Fixtures','Sanitary fixtures',260),
  ('Electrical Fixtures','Electrical fixtures',270),
  ('Snag Rectification','Snagging',280),
  ('Cleaning','Site cleaning',290)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.materials (name, unit, category) VALUES
  ('MS RHS','kg','Steel'),('MS Sheets','sft','Steel'),('GI Channels','rft','Framing'),
  ('Cement Fibre Boards','sft','Boards'),('Rockwool','sft','Insulation'),
  ('Vapour/Moisture Membrane','sft','Membrane'),('Screws','nos','Fasteners'),
  ('Rivets','nos','Fasteners'),('Fasteners','nos','Fasteners'),
  ('PU Chemical','kg','Sealant'),('Joint Compound','kg','Finishing'),
  ('Putty','kg','Finishing'),('Primer','lt','Paint'),('Paint','lt','Paint'),
  ('Electrical Conduits','rft','Electrical'),('Electrical Wires','rft','Electrical'),
  ('Plumbing Pipes','rft','Plumbing'),('Plumbing Fittings','nos','Plumbing'),
  ('Sealants','kg','Sealant'),('Roofing Materials','sft','Roofing'),
  ('Tiles','sft','Finishing')
ON CONFLICT (name) DO NOTHING;

WITH a AS (SELECT id, name FROM public.activity_types)
INSERT INTO public.activity_dependencies (project_id, activity_type_id, prerequisite_activity_type_id)
SELECT NULL, x.id, y.id
FROM a x, a y
WHERE
  (x.name='Rockwool Insulation' AND y.name IN ('Electrical Rough-In','Plumbing Rough-In','Plumbing Pressure Testing','Internal Board Fixing'))
  OR (x.name='External Vapour Barrier' AND y.name='Rockwool Insulation')
  OR (x.name='External Board Fixing' AND y.name='External Vapour Barrier')
  OR (x.name='Joint Treatment' AND y.name IN ('Internal Board Fixing','External Board Fixing'))
  OR (x.name='Internal Putty' AND y.name='Joint Treatment')
  OR (x.name='Primer' AND y.name='Internal Putty')
  OR (x.name='Internal Painting' AND y.name='Primer')
  OR (x.name='External Primer' AND y.name IN ('External Board Fixing','Joint Treatment','Waterproofing'))
  OR (x.name='External Texture' AND y.name='External Primer')
  OR (x.name='External Painting' AND y.name IN ('External Primer','External Texture'))
ON CONFLICT DO NOTHING;
