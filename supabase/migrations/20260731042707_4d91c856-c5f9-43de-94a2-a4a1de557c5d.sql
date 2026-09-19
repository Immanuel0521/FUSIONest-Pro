CREATE TYPE public.dispatch_status AS ENUM ('preparing','dispatched','in_transit','partially_received','received','issue');

CREATE TABLE public.material_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dispatch_number text NOT NULL,
  source text NOT NULL DEFAULT 'factory',
  vendor_name text,
  vehicle_number text,
  driver_name text,
  driver_phone text,
  dispatch_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  received_at timestamptz,
  received_by uuid,
  status public.dispatch_status NOT NULL DEFAULT 'preparing',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_dispatches TO authenticated;
GRANT ALL ON public.material_dispatches TO service_role;
ALTER TABLE public.material_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project dispatches" ON public.material_dispatches
  FOR SELECT TO authenticated USING (public.can_view_project_materials(project_id));
CREATE POLICY "Manage project dispatches" ON public.material_dispatches
  FOR ALL TO authenticated USING (public.can_manage_project_materials(project_id))
  WITH CHECK (public.can_manage_project_materials(project_id));

CREATE TABLE public.material_dispatch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES public.material_dispatches(id) ON DELETE CASCADE,
  project_material_id uuid REFERENCES public.project_materials(id) ON DELETE SET NULL,
  material_name text NOT NULL,
  unit text NOT NULL DEFAULT 'nos',
  qty_sent numeric NOT NULL DEFAULT 0,
  qty_received numeric,
  condition text,
  shortage_qty numeric NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_dispatch_items TO authenticated;
GRANT ALL ON public.material_dispatch_items TO service_role;
ALTER TABLE public.material_dispatch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View dispatch items" ON public.material_dispatch_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.material_dispatches d
    WHERE d.id = dispatch_id AND public.can_view_project_materials(d.project_id)));
CREATE POLICY "Manage dispatch items" ON public.material_dispatch_items
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.material_dispatches d
    WHERE d.id = dispatch_id AND public.can_manage_project_materials(d.project_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.material_dispatches d
    WHERE d.id = dispatch_id AND public.can_manage_project_materials(d.project_id)));

CREATE INDEX idx_dispatches_project ON public.material_dispatches(project_id, dispatch_date DESC);
CREATE INDEX idx_dispatch_items_dispatch ON public.material_dispatch_items(dispatch_id);

CREATE TRIGGER trg_dispatches_updated BEFORE UPDATE ON public.material_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dispatch_items_updated BEFORE UPDATE ON public.material_dispatch_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();