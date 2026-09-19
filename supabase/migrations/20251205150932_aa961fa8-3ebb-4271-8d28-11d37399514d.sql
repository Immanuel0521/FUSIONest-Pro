-- Create worker_department enum type
CREATE TYPE public.worker_department AS ENUM (
  'fitters', 'assembly_team', 'helpers', 'painters', 
  'plumbers', 'electricians', 'supervisors', 'guest_workers'
);

-- Create project_status enum type
CREATE TYPE public.project_status AS ENUM ('active', 'completed', 'on_hold');

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_name TEXT,
  location TEXT,
  start_date DATE,
  expected_end_date DATE,
  actual_end_date DATE,
  status project_status DEFAULT 'active',
  description TEXT,
  supervisor_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create activity_types table
CREATE TABLE public.activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_custom BOOLEAN DEFAULT false,
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert predefined activities
INSERT INTO public.activity_types (name, display_order) VALUES
  ('Steel Frame Fabrication', 1),
  ('GI Frame Fabrication', 2),
  ('Floor Board Fixing', 3),
  ('GI Frame Assembly', 4),
  ('Internal Wall Panel Assembly', 5),
  ('Electrical Wiring', 6),
  ('Plumbing Installation', 7),
  ('External Wall Panel Assembly', 8),
  ('Roofing', 9),
  ('Finishing Works', 10),
  ('Tiles Work', 11),
  ('Joint Compound Work', 12),
  ('Putty Work', 13),
  ('Primer Application', 14),
  ('Painting', 15),
  ('Other', 16);

-- Create daily_activities table
CREATE TABLE public.daily_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_type_id UUID REFERENCES public.activity_types(id),
  custom_activity_name TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  progress_percentage INT DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  estimated_finish_date DATE,
  issues_faced TEXT,
  materials_used TEXT,
  supervisor_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create activity_photos table
CREATE TABLE public.activity_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_activity_id UUID REFERENCES public.daily_activities(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create activity_workers table
CREATE TABLE public.activity_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_activity_id UUID REFERENCES public.daily_activities(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  guest_worker_name TEXT,
  department public.worker_department NOT NULL,
  hours_worked NUMERIC(4,2) DEFAULT 8,
  ot_hours NUMERIC(4,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_workers ENABLE ROW LEVEL SECURITY;

-- Projects RLS policies
CREATE POLICY "Supervisors can view their own projects"
ON public.projects FOR SELECT
USING (auth.uid() = supervisor_id OR has_role(auth.uid(), 'admin'::supervisor_role));

CREATE POLICY "Supervisors can create projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can update their own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = supervisor_id OR has_role(auth.uid(), 'admin'::supervisor_role));

CREATE POLICY "Supervisors can delete their own projects"
ON public.projects FOR DELETE
USING (auth.uid() = supervisor_id OR has_role(auth.uid(), 'admin'::supervisor_role));

-- Activity types RLS (read for all authenticated)
CREATE POLICY "Anyone can view activity types"
ON public.activity_types FOR SELECT
USING (true);

CREATE POLICY "Admins can manage activity types"
ON public.activity_types FOR ALL
USING (has_role(auth.uid(), 'admin'::supervisor_role));

-- Daily activities RLS
CREATE POLICY "Supervisors can view their own activities"
ON public.daily_activities FOR SELECT
USING (auth.uid() = supervisor_id OR has_role(auth.uid(), 'admin'::supervisor_role));

CREATE POLICY "Supervisors can create activities"
ON public.daily_activities FOR INSERT
WITH CHECK (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can update their own activities"
ON public.daily_activities FOR UPDATE
USING (auth.uid() = supervisor_id OR has_role(auth.uid(), 'admin'::supervisor_role));

CREATE POLICY "Supervisors can delete their own activities"
ON public.daily_activities FOR DELETE
USING (auth.uid() = supervisor_id OR has_role(auth.uid(), 'admin'::supervisor_role));

-- Activity photos RLS
CREATE POLICY "Users can view activity photos"
ON public.activity_photos FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.daily_activities da
  WHERE da.id = daily_activity_id
  AND (da.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'::supervisor_role))
));

CREATE POLICY "Supervisors can add activity photos"
ON public.activity_photos FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.daily_activities da
  WHERE da.id = daily_activity_id AND da.supervisor_id = auth.uid()
));

CREATE POLICY "Supervisors can delete activity photos"
ON public.activity_photos FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.daily_activities da
  WHERE da.id = daily_activity_id
  AND (da.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'::supervisor_role))
));

-- Activity workers RLS
CREATE POLICY "Users can view activity workers"
ON public.activity_workers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.daily_activities da
  WHERE da.id = daily_activity_id
  AND (da.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'::supervisor_role))
));

CREATE POLICY "Supervisors can manage activity workers"
ON public.activity_workers FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.daily_activities da
  WHERE da.id = daily_activity_id AND da.supervisor_id = auth.uid()
));

-- Create storage bucket for activity photos
INSERT INTO storage.buckets (id, name, public) VALUES ('activity-photos', 'activity-photos', false);

-- Storage policies for activity photos
CREATE POLICY "Authenticated users can upload activity photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'activity-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view activity photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'activity-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their activity photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'activity-photos' AND auth.role() = 'authenticated');

-- Update triggers for timestamps
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_activities_updated_at
BEFORE UPDATE ON public.daily_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();