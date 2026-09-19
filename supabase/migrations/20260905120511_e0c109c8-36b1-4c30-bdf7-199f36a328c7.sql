CREATE TABLE public.attendance_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'teal',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_groups TO authenticated;
GRANT ALL ON public.attendance_groups TO service_role;
ALTER TABLE public.attendance_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view attendance groups"
ON public.attendance_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and owners can insert attendance groups"
ON public.attendance_groups FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management') OR created_by = auth.uid()
);

CREATE POLICY "Admins and owners can update attendance groups"
ON public.attendance_groups FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management') OR created_by = auth.uid())
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management') OR created_by = auth.uid());

CREATE POLICY "Admins and owners can delete attendance groups"
ON public.attendance_groups FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management') OR created_by = auth.uid());

CREATE TRIGGER trg_attendance_groups_updated
BEFORE UPDATE ON public.attendance_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.attendance_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.attendance_groups(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, worker_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_group_members TO authenticated;
GRANT ALL ON public.attendance_group_members TO service_role;
ALTER TABLE public.attendance_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view attendance group members"
ON public.attendance_group_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Group managers can add members"
ON public.attendance_group_members FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.attendance_groups g WHERE g.id = group_id
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management') OR g.created_by = auth.uid())
));

CREATE POLICY "Group managers can remove members"
ON public.attendance_group_members FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.attendance_groups g WHERE g.id = group_id
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management') OR g.created_by = auth.uid())
));

CREATE INDEX idx_agm_group ON public.attendance_group_members(group_id);
CREATE INDEX idx_agm_worker ON public.attendance_group_members(worker_id);