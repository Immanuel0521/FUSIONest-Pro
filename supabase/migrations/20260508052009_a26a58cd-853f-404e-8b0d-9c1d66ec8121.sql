
-- Add new columns to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS budget numeric(12,2),
  ADD COLUMN IF NOT EXISTS project_manager text,
  ADD COLUMN IF NOT EXISTS completion_percentage integer DEFAULT 0;

-- Add not_started to project_status enum (if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'not_started' AND enumtypid = 'public.project_status'::regtype) THEN
    ALTER TYPE public.project_status ADD VALUE 'not_started';
  END IF;
END$$;

-- Extend daily_activities
ALTER TABLE public.daily_activities
  ADD COLUMN IF NOT EXISTS hours_worked numeric(5,2),
  ADD COLUMN IF NOT EXISTS equipment_used text,
  ADD COLUMN IF NOT EXISTS weather_conditions text,
  ADD COLUMN IF NOT EXISTS notes text;

-- project_workers
CREATE TABLE IF NOT EXISTS public.project_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  role text,
  assigned_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, worker_id)
);
ALTER TABLE public.project_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors view project workers"
  ON public.project_workers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_workers.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "Supervisors manage project workers"
  ON public.project_workers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_workers.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_workers.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- project_milestones
CREATE TABLE IF NOT EXISTS public.project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  target_date date,
  completion_date date,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors view milestones"
  ON public.project_milestones FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_milestones.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "Supervisors manage milestones"
  ON public.project_milestones FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_milestones.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_milestones.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE TRIGGER trg_milestones_updated
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- progress_history
CREATE TABLE IF NOT EXISTS public.progress_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  completion_percentage integer NOT NULL,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.progress_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors view progress history"
  ON public.progress_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = progress_history.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "Supervisors insert progress history"
  ON public.progress_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = progress_history.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- project_photos
CREATE TABLE IF NOT EXISTS public.project_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  photo_url text NOT NULL,
  caption text,
  date_taken date DEFAULT CURRENT_DATE,
  category text DEFAULT 'progress',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors view project photos"
  ON public.project_photos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_photos.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "Supervisors manage project photos"
  ON public.project_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_photos.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_photos.project_id AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- project-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Supervisors view project photo files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Supervisors upload project photo files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Supervisors delete project photo files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-photos' AND auth.uid() IS NOT NULL);
