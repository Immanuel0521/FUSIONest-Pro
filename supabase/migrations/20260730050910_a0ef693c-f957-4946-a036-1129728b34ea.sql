-- Reference sheet
CREATE TABLE public.project_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id),
  name text NOT NULL,
  category text,
  specification text,
  size text,
  thickness text,
  grade text,
  unit text NOT NULL DEFAULT 'nos',
  stage text,
  boq_qty numeric NOT NULL DEFAULT 0,
  min_stock_level numeric NOT NULL DEFAULT 0,
  vendor text,
  image_url text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_materials TO authenticated;
GRANT ALL ON public.project_materials TO service_role;
ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_project_materials(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id
      AND (p.supervisor_id = auth.uid() OR p.project_manager_id = auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.can_view_project_materials(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage_project_materials(_project_id) OR has_role(auth.uid(),'procurement');
$$;

CREATE POLICY "view project materials" ON public.project_materials FOR SELECT TO authenticated
  USING (public.can_view_project_materials(project_id));
CREATE POLICY "insert project materials" ON public.project_materials FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project_materials(project_id));
CREATE POLICY "update project materials" ON public.project_materials FOR UPDATE TO authenticated
  USING (public.can_manage_project_materials(project_id))
  WITH CHECK (public.can_manage_project_materials(project_id));
CREATE POLICY "delete project materials" ON public.project_materials FOR DELETE TO authenticated
  USING (public.can_manage_project_materials(project_id));

CREATE TRIGGER trg_project_materials_updated BEFORE UPDATE ON public.project_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_project_materials_project ON public.project_materials(project_id);

-- Ledger
CREATE TABLE public.stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_material_id uuid NOT NULL REFERENCES public.project_materials(id) ON DELETE CASCADE,
  txn_type text NOT NULL CHECK (txn_type IN ('receipt','usage','adjustment','reversal')),
  qty numeric NOT NULL,
  reason text,
  ref_type text,
  ref_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.stock_transactions TO authenticated;
GRANT ALL ON public.stock_transactions TO service_role;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view stock txns" ON public.stock_transactions FOR SELECT TO authenticated
  USING (public.can_view_project_materials(project_id));
CREATE POLICY "insert stock txns" ON public.stock_transactions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project_materials(project_id) AND created_by = auth.uid());

CREATE INDEX idx_stock_txn_project ON public.stock_transactions(project_id);
CREATE INDEX idx_stock_txn_material ON public.stock_transactions(project_material_id);

-- Derived stock view
CREATE VIEW public.project_stock_summary
WITH (security_invoker = true) AS
SELECT pm.id AS project_material_id,
       pm.project_id,
       pm.name,
       pm.category,
       pm.unit,
       pm.stage,
       pm.boq_qty,
       pm.min_stock_level,
       pm.vendor,
       COALESCE(SUM(CASE WHEN st.txn_type IN ('receipt','adjustment','reversal') THEN st.qty
                         WHEN st.txn_type = 'usage' THEN -st.qty END), 0) AS current_stock,
       COALESCE(SUM(CASE WHEN st.txn_type = 'usage' THEN st.qty ELSE 0 END), 0) AS total_used,
       COALESCE(SUM(CASE WHEN st.txn_type = 'receipt' THEN st.qty ELSE 0 END), 0) AS total_received
FROM public.project_materials pm
LEFT JOIN public.stock_transactions st ON st.project_material_id = pm.id
WHERE pm.active
GROUP BY pm.id;

GRANT SELECT ON public.project_stock_summary TO authenticated;
GRANT ALL ON public.project_stock_summary TO service_role;