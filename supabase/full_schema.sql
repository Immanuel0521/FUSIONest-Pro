-- ========== 20251023131108_6a98a521-bc19-46ae-ac73-f1bf63f89e3e.sql ==========
-- Create enum for blood groups
CREATE TYPE blood_group AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

-- Create workers table
CREATE TABLE public.workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  emergency_contact TEXT NOT NULL,
  bank_details TEXT NOT NULL,
  blood_group blood_group NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance_logs table
CREATE TABLE public.attendance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shift_start TIME NOT NULL DEFAULT '09:00',
  shift_end TIME NOT NULL DEFAULT '18:00',
  is_late BOOLEAN NOT NULL DEFAULT false,
  late_minutes INTEGER DEFAULT 0,
  overtime_hours DECIMAL(4,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Workers RLS policies
CREATE POLICY "Supervisors can view their own workers" 
ON public.workers 
FOR SELECT 
USING (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can create workers" 
ON public.workers 
FOR INSERT 
WITH CHECK (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can update their own workers" 
ON public.workers 
FOR UPDATE 
USING (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can delete their own workers" 
ON public.workers 
FOR DELETE 
USING (auth.uid() = supervisor_id);

-- Attendance logs RLS policies
CREATE POLICY "Supervisors can view their own attendance logs" 
ON public.attendance_logs 
FOR SELECT 
USING (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can create attendance logs" 
ON public.attendance_logs 
FOR INSERT 
WITH CHECK (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can update their own attendance logs" 
ON public.attendance_logs 
FOR UPDATE 
USING (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can delete their own attendance logs" 
ON public.attendance_logs 
FOR DELETE 
USING (auth.uid() = supervisor_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_workers_updated_at
BEFORE UPDATE ON public.workers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_logs_updated_at
BEFORE UPDATE ON public.attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster searches
CREATE INDEX idx_workers_full_name ON public.workers(full_name);
CREATE INDEX idx_attendance_logs_date ON public.attendance_logs(date);
CREATE INDEX idx_attendance_logs_worker_id ON public.attendance_logs(worker_id);


-- ========== 20251027164353_6bd18e5a-9db9-4a50-8d59-601aa12b9020.sql ==========
-- Add new columns to workers table
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS date_of_joining DATE,
ADD COLUMN IF NOT EXISTS designation TEXT;

-- Create storage bucket for worker photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-photos', 'worker-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for worker photos
CREATE POLICY "Worker photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-photos');

CREATE POLICY "Supervisors can upload worker photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'worker-photos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Supervisors can update worker photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'worker-photos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Supervisors can delete worker photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'worker-photos' 
  AND auth.uid() IS NOT NULL
);


-- ========== 20251028053318_622a519c-4b11-4299-8cbf-35d56db71cd3.sql ==========
-- Create enum for supervisor roles
CREATE TYPE public.supervisor_role AS ENUM ('admin', 'supervisor', 'viewer');

-- Create user_roles table for role-based access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role supervisor_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role supervisor_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Update workers table RLS policies to support admin access
DROP POLICY IF EXISTS "Supervisors can view their own workers" ON public.workers;
CREATE POLICY "Supervisors can view their own workers"
ON public.workers
FOR SELECT
USING (
  auth.uid() = supervisor_id 
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Supervisors can update their own workers" ON public.workers;
CREATE POLICY "Supervisors can update their own workers"
ON public.workers
FOR UPDATE
USING (
  auth.uid() = supervisor_id 
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Supervisors can delete their own workers" ON public.workers;
CREATE POLICY "Supervisors can delete their own workers"
ON public.workers
FOR DELETE
USING (
  auth.uid() = supervisor_id 
  OR public.has_role(auth.uid(), 'admin')
);

-- Update attendance_logs RLS policies to support admin access
DROP POLICY IF EXISTS "Supervisors can view their own attendance logs" ON public.attendance_logs;
CREATE POLICY "Supervisors can view their own attendance logs"
ON public.attendance_logs
FOR SELECT
USING (
  auth.uid() = supervisor_id 
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Supervisors can update their own attendance logs" ON public.attendance_logs;
CREATE POLICY "Supervisors can update their own attendance logs"
ON public.attendance_logs
FOR UPDATE
USING (
  auth.uid() = supervisor_id 
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Supervisors can delete their own attendance logs" ON public.attendance_logs;
CREATE POLICY "Supervisors can delete their own attendance logs"
ON public.attendance_logs
FOR DELETE
USING (
  auth.uid() = supervisor_id 
  OR public.has_role(auth.uid(), 'admin')
);

-- Create a function to get all supervisors (for admin use)
CREATE OR REPLACE FUNCTION public.get_all_supervisors()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    au.id,
    au.email,
    au.created_at
  FROM auth.users au
  WHERE public.has_role(auth.uid(), 'admin')
$$;


-- ========== 20251029041211_798f7955-71be-4813-9870-1a742bf5ffc9.sql ==========
-- Create backups storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for backups bucket (admin only)
CREATE POLICY "Admins can upload backups"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'backups' 
  AND has_role(auth.uid(), 'admin'::supervisor_role)
);

CREATE POLICY "Admins can view backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups' 
  AND has_role(auth.uid(), 'admin'::supervisor_role)
);

CREATE POLICY "Admins can download backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups' 
  AND has_role(auth.uid(), 'admin'::supervisor_role)
);

CREATE POLICY "Admins can delete backups"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'backups' 
  AND has_role(auth.uid(), 'admin'::supervisor_role)
);


-- ========== 20251030051926_2bb91589-6761-442d-93d7-4f678fdc5ea2.sql ==========
-- Add new columns to attendance_logs table for enhanced attendance tracking
ALTER TABLE attendance_logs 
ADD COLUMN IF NOT EXISTS time_out timestamp with time zone,
ADD COLUMN IF NOT EXISTS total_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_exit boolean DEFAULT false;

-- Add comment to describe the columns
COMMENT ON COLUMN attendance_logs.time_out IS 'Exit/checkout time of the worker';
COMMENT ON COLUMN attendance_logs.total_hours IS 'Total working hours calculated from time_in to time_out';
COMMENT ON COLUMN attendance_logs.early_exit IS 'Whether worker left before shift end time';


-- ========== 20251031035200_258592e4-8d77-46c6-80f8-c94dd6758e92.sql ==========
-- Make worker-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'worker-photos';


-- ========== 20251031035709_3e5705f0-06bb-441c-9806-ee5f5320f269.sql ==========
-- Fix storage exposure: Remove public SELECT policy on worker-photos bucket
-- and add authenticated-only access policy

-- Drop the public SELECT policy that allows unauthenticated access
DROP POLICY IF EXISTS "Worker photos are publicly accessible" ON storage.objects;

-- Create a new policy that only allows authenticated users to view worker photos
CREATE POLICY "Authenticated users can view worker photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-photos' AND auth.uid() IS NOT NULL);


-- ========== 20251110143637_56430e42-530f-47ce-a7e8-62148568bdbf.sql ==========
-- Create user_profiles table for profile management
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  photo_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.user_profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::supervisor_role));

-- Create supervisor_attendance table
CREATE TABLE IF NOT EXISTS public.supervisor_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_out TIMESTAMPTZ,
  total_hours NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supervisor_id, date)
);

-- Enable RLS on supervisor_attendance
ALTER TABLE public.supervisor_attendance ENABLE ROW LEVEL SECURITY;

-- Supervisors can view their own attendance
CREATE POLICY "Supervisors can view their own attendance"
ON public.supervisor_attendance
FOR SELECT
USING (auth.uid() = supervisor_id);

-- Supervisors can insert their own attendance
CREATE POLICY "Supervisors can insert their own attendance"
ON public.supervisor_attendance
FOR INSERT
WITH CHECK (auth.uid() = supervisor_id);

-- Supervisors can update their own attendance
CREATE POLICY "Supervisors can update their own attendance"
ON public.supervisor_attendance
FOR UPDATE
USING (auth.uid() = supervisor_id);

-- Admins can view all supervisor attendance
CREATE POLICY "Admins can view all supervisor attendance"
ON public.supervisor_attendance
FOR SELECT
USING (has_role(auth.uid(), 'admin'::supervisor_role));

-- Add trigger for updated_at on user_profiles
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on supervisor_attendance
CREATE TRIGGER update_supervisor_attendance_updated_at
BEFORE UPDATE ON public.supervisor_attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for profile photos
CREATE POLICY "Users can view their own profile photo"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own profile photo"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own profile photo"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own profile photo"
ON storage.objects
FOR DELETE
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ========== 20251201042817_af9e5e55-0012-49f5-a7b8-0e1ddb8edc58.sql ==========
-- Add notes_in and notes_out fields to attendance_logs
ALTER TABLE public.attendance_logs
ADD COLUMN notes_in TEXT,
ADD COLUMN notes_out TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.attendance_logs.notes_in IS 'Notes entered by supervisor during check-in';
COMMENT ON COLUMN public.attendance_logs.notes_out IS 'Notes entered by supervisor during check-out';


-- ========== 20251205150932_aa961fa8-3ebb-4271-8d28-11d37399514d.sql ==========
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


-- ========== 20251210153752_27bebf67-793c-4a4c-b5d7-1305cfcb7c19.sql ==========
-- Create notifications table for activity alerts
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('delay', 'milestone', 'daily_summary', 'ai_insight')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.daily_activities(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- System can insert notifications (via service role)
CREATE POLICY "Service can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ========== 20251221095907_2cb068f0-c308-4f0c-b733-332fa4af3896.sql ==========
-- Fix notifications RLS policy to only allow service role or own notifications
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;

-- Allow only service role (Edge Functions) OR users inserting their own notifications
CREATE POLICY "Service role or own notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  auth.jwt()->>'role' = 'service_role' 
  OR auth.uid() = user_id
);


-- ========== 20251221100509_d8c38fb0-9976-451c-874c-a3500ceeb9ed.sql ==========
-- Create a server-side RPC function to verify admin access
-- This moves the admin check to server-side, improving security
CREATE OR REPLACE FUNCTION public.verify_admin_access()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin');
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.verify_admin_access() TO authenticated;


-- ========== 20260119143306_82170823-772e-4663-8966-5114c5015b08.sql ==========
-- Create a function to validate that a worker belongs to a supervisor before allowing attendance log operations
-- This provides additional server-side validation to prevent cross-supervisor data access

CREATE OR REPLACE FUNCTION public.validate_worker_supervisor_relationship()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate that the worker belongs to the supervisor creating/updating the attendance log
  IF NOT EXISTS (
    SELECT 1 FROM public.workers 
    WHERE id = NEW.worker_id 
    AND (supervisor_id = NEW.supervisor_id OR public.has_role(NEW.supervisor_id, 'admin'))
  ) THEN
    RAISE EXCEPTION 'Worker does not belong to this supervisor';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for INSERT operations on attendance_logs
DROP TRIGGER IF EXISTS validate_attendance_worker_supervisor ON public.attendance_logs;
CREATE TRIGGER validate_attendance_worker_supervisor
BEFORE INSERT ON public.attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.validate_worker_supervisor_relationship();

-- Create trigger for UPDATE operations on attendance_logs
DROP TRIGGER IF EXISTS validate_attendance_worker_supervisor_update ON public.attendance_logs;
CREATE TRIGGER validate_attendance_worker_supervisor_update
BEFORE UPDATE ON public.attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.validate_worker_supervisor_relationship();

-- Also add validation for activity_workers to ensure workers in activities belong to the right supervisor
CREATE OR REPLACE FUNCTION public.validate_activity_worker_relationship()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_supervisor_id UUID;
BEGIN
  -- Get the supervisor_id from the parent daily_activity
  SELECT supervisor_id INTO activity_supervisor_id
  FROM public.daily_activities
  WHERE id = NEW.daily_activity_id;
  
  -- If worker_id is provided (not a guest worker), validate the relationship
  IF NEW.worker_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workers 
      WHERE id = NEW.worker_id 
      AND (supervisor_id = activity_supervisor_id OR public.has_role(activity_supervisor_id, 'admin'))
    ) THEN
      RAISE EXCEPTION 'Worker does not belong to the activity supervisor';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for activity_workers
DROP TRIGGER IF EXISTS validate_activity_worker ON public.activity_workers;
CREATE TRIGGER validate_activity_worker
BEFORE INSERT ON public.activity_workers
FOR EACH ROW
EXECUTE FUNCTION public.validate_activity_worker_relationship();

DROP TRIGGER IF EXISTS validate_activity_worker_update ON public.activity_workers;
CREATE TRIGGER validate_activity_worker_update
BEFORE UPDATE ON public.activity_workers
FOR EACH ROW
EXECUTE FUNCTION public.validate_activity_worker_relationship();


-- ========== 20260119145625_cb6d992b-9d5b-4f7e-bdad-e97e6feb0ff0.sql ==========
-- Create fingerprint templates table for USB fingerprint scanner data
CREATE TABLE public.fingerprint_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  template_data TEXT NOT NULL, -- Base64 encoded fingerprint template from USB scanner
  finger_index INTEGER NOT NULL DEFAULT 1, -- 1-10 representing which finger
  quality_score INTEGER, -- Quality score from scanner (0-100)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL, -- supervisor who registered the fingerprint
  UNIQUE(worker_id, finger_index)
);

-- Enable RLS
ALTER TABLE public.fingerprint_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for fingerprint templates
CREATE POLICY "Admins can manage all fingerprint templates"
ON public.fingerprint_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::supervisor_role));

CREATE POLICY "Supervisors can view their workers fingerprints"
ON public.fingerprint_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workers 
    WHERE workers.id = fingerprint_templates.worker_id 
    AND workers.supervisor_id = auth.uid()
  )
);

CREATE POLICY "Supervisors can manage their workers fingerprints"
ON public.fingerprint_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workers 
    WHERE workers.id = fingerprint_templates.worker_id 
    AND workers.supervisor_id = auth.uid()
  )
);

CREATE POLICY "Supervisors can update their workers fingerprints"
ON public.fingerprint_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workers 
    WHERE workers.id = fingerprint_templates.worker_id 
    AND workers.supervisor_id = auth.uid()
  )
);

CREATE POLICY "Supervisors can delete their workers fingerprints"
ON public.fingerprint_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workers 
    WHERE workers.id = fingerprint_templates.worker_id 
    AND workers.supervisor_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_fingerprint_templates_worker ON public.fingerprint_templates(worker_id);

-- Add trigger for updating updated_at
CREATE TRIGGER update_fingerprint_templates_updated_at
BEFORE UPDATE ON public.fingerprint_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- ========== 20260121163028_01819d39-6d14-426c-a0e3-2c391cd5a6b7.sql ==========
-- Fix: Restrict activity_types SELECT access to authenticated users only
DROP POLICY IF EXISTS "Anyone can view activity types" ON public.activity_types;

CREATE POLICY "Authenticated users can view activity types"
ON public.activity_types FOR SELECT
TO authenticated
USING (true);


-- ========== 20260121164953_401c9e14-d97a-4d35-aea4-3085c25d48ad.sql ==========
-- Add salary and OT rate fields to workers table
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ot_rate_per_hour NUMERIC DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.workers.monthly_salary IS 'Monthly salary amount in base currency';
COMMENT ON COLUMN public.workers.ot_rate_per_hour IS 'Overtime rate per hour in base currency';


-- ========== 20260202185536_7ef5679d-3832-4371-ad19-7eba1af0c488.sql ==========
-- Create daily_work_notes table for work allocation tracking
CREATE TABLE public.daily_work_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT NOT NULL,
  location TEXT,
  worker_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.daily_work_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supervisors to manage their own notes
CREATE POLICY "Supervisors can view their own notes"
  ON public.daily_work_notes
  FOR SELECT
  USING (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can create their own notes"
  ON public.daily_work_notes
  FOR INSERT
  WITH CHECK (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can update their own notes"
  ON public.daily_work_notes
  FOR UPDATE
  USING (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can delete their own notes"
  ON public.daily_work_notes
  FOR DELETE
  USING (auth.uid() = supervisor_id);

-- Admins can view all notes
CREATE POLICY "Admins can view all notes"
  ON public.daily_work_notes
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_daily_work_notes_updated_at
  BEFORE UPDATE ON public.daily_work_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ========== 20260202190938_77473e54-42bb-495b-aba6-f1e3e6d3b497.sql ==========
-- Add monitored_by column to track supervisor names at each site
ALTER TABLE public.daily_work_notes 
ADD COLUMN monitored_by TEXT;


-- ========== 20260203134624_47072fac-fe8f-461c-9317-7ac5683bff41.sql ==========
-- Create face_embeddings table to store face data for recognition
CREATE TABLE public.face_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  embedding_data JSONB NOT NULL, -- Store face descriptor array
  photo_url TEXT, -- Reference photo used for registration
  quality_score NUMERIC(5,2), -- Confidence/quality of the embedding
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(worker_id)
);

-- Add location columns to attendance_logs for GPS tracking
ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS location_in JSONB, -- {lat, lng, accuracy}
ADD COLUMN IF NOT EXISTS location_out JSONB,
ADD COLUMN IF NOT EXISTS face_verified_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS face_verified_out BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS face_confidence_in NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS face_confidence_out NUMERIC(5,2);

-- Enable RLS on face_embeddings
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;

-- Policies for face_embeddings
CREATE POLICY "Authenticated users can view face embeddings"
  ON public.face_embeddings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and supervisors can manage face embeddings"
  ON public.face_embeddings FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );

-- Create worker_auth table for worker login (face-only, no password)
CREATE TABLE public.worker_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE UNIQUE,
  pin_code TEXT, -- Optional 4-digit PIN for extra security
  last_login TIMESTAMPTZ,
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  consent_given BOOLEAN DEFAULT false,
  consent_given_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_auth ENABLE ROW LEVEL SECURITY;

-- Workers can read their own auth record
CREATE POLICY "Workers can view their own auth"
  ON public.worker_auth FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/supervisors can manage worker auth
CREATE POLICY "Admins can manage worker auth"
  ON public.worker_auth FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );

-- Create audit_logs table for admin actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can insert audit logs
CREATE POLICY "Users can create audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_face_embeddings_updated_at
  BEFORE UPDATE ON public.face_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_auth_updated_at
  BEFORE UPDATE ON public.worker_auth
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ========== 20260205063209_eac63810-c582-47d6-b804-395d6b8ec5ff.sql ==========
-- Fix: Restrict face embeddings access to supervisors of workers and admins only
-- This prevents any authenticated user from reading all biometric data

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view face embeddings" ON public.face_embeddings;

-- Create a properly scoped SELECT policy
CREATE POLICY "Supervisors can view their workers face data"
ON public.face_embeddings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = face_embeddings.worker_id
    AND (w.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'::supervisor_role))
  )
);


-- ========== 20260209071229_d987cd88-25f2-45c0-b86b-2cd9cb85c383.sql ==========

-- Add unique constraint on (worker_id, date) to enforce one record per worker per day
ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_worker_date_unique UNIQUE (worker_id, date);


-- ========== 20260210152220_c80cef19-960f-4c38-bcd7-7b08d3523453.sql ==========

-- Add source tracking columns to attendance_logs
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS checkin_source text DEFAULT 'manual';
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS checkout_source text;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS recorded_by text;


-- ========== 20260210153742_50078616-06d8-46ed-a602-7ea901c230bb.sql ==========

-- Fix 1: Replace overly permissive activity-photos storage DELETE policy
DROP POLICY IF EXISTS "Users can delete their activity photos" ON storage.objects;

CREATE POLICY "Supervisors can delete their own activity photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'activity-photos' 
  AND EXISTS (
    SELECT 1 FROM public.activity_photos ap
    JOIN public.daily_activities da ON da.id = ap.daily_activity_id
    WHERE ap.photo_url LIKE '%' || storage.objects.name
    AND (da.supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.supervisor_role))
  )
);

-- Fix 2: Replace overly permissive worker_auth SELECT policy
DROP POLICY IF EXISTS "Workers can view their own auth" ON public.worker_auth;

-- Only supervisors can view their own workers' auth (without exposing pin_code directly)
CREATE POLICY "Supervisors view their workers auth"
ON public.worker_auth FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = worker_auth.worker_id
    AND (w.supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.supervisor_role))
  )
);

-- Fix 3: Hash existing plaintext PIN codes using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to verify worker PINs securely (SECURITY DEFINER so it bypasses RLS)
CREATE OR REPLACE FUNCTION public.verify_worker_pin(p_worker_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.worker_auth
    WHERE worker_id = p_worker_id
    AND pin_code = crypt(p_pin, pin_code)
  );
END;
$$;

-- Create a function to set a hashed PIN
CREATE OR REPLACE FUNCTION public.set_worker_pin(p_worker_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.worker_auth
  SET pin_code = crypt(p_pin, gen_salt('bf', 8)),
      updated_at = now()
  WHERE worker_id = p_worker_id;
  RETURN FOUND;
END;
$$;

-- Hash all existing plaintext PINs (those not already hashed - bcrypt hashes start with $2)
UPDATE public.worker_auth
SET pin_code = crypt(pin_code, gen_salt('bf', 8))
WHERE pin_code IS NOT NULL 
AND pin_code != ''
AND pin_code NOT LIKE '$2%';


-- ========== 20260213092609_0a624f75-6e61-4d43-9eef-5c8dce3425a2.sql ==========

-- Table for storing face attendance photos for admin review
CREATE TABLE public.attendance_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.attendance_logs(id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'checkin' CHECK (photo_type IN ('checkin', 'checkout')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  approved BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_photos ENABLE ROW LEVEL SECURITY;

-- Admins can see all photos
CREATE POLICY "Admins can view all attendance photos"
ON public.attendance_photos FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Supervisors can see their workers' photos
CREATE POLICY "Supervisors can view their workers photos"
ON public.attendance_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = attendance_photos.worker_id
    AND w.supervisor_id = auth.uid()
  )
);

-- Supervisors can insert photos for their workers
CREATE POLICY "Supervisors can insert attendance photos"
ON public.attendance_photos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = attendance_photos.worker_id
    AND (w.supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Admins can update (approve) photos
CREATE POLICY "Admins can update attendance photos"
ON public.attendance_photos FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete photos
CREATE POLICY "Admins can delete attendance photos"
ON public.attendance_photos FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Index for quick lookups
CREATE INDEX idx_attendance_photos_worker_date ON public.attendance_photos(worker_id, date);
CREATE INDEX idx_attendance_photos_approved ON public.attendance_photos(approved, approved_at);


-- ========== 20260213092907_096e8e7d-4e38-4bcb-936b-85c1d7e5b034.sql ==========

-- Create storage bucket for attendance photos
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow supervisors to upload attendance photos
CREATE POLICY "Supervisors can upload attendance photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'attendance-photos'
  AND auth.role() = 'authenticated'
);

-- Public read access for attendance photos
CREATE POLICY "Attendance photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'attendance-photos');

-- Admins can delete attendance photos
CREATE POLICY "Admins can delete attendance photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'attendance-photos'
  AND public.has_role(auth.uid(), 'admin')
);

-- Enable pg_cron and pg_net for auto-cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ========== 20260316110802_0ec55d21-c266-42f5-ad30-1c30063cb2b7.sql ==========

-- Remove the unique constraint on worker_id to allow multiple face embeddings per worker (front, left, right angles)
ALTER TABLE public.face_embeddings DROP CONSTRAINT IF EXISTS face_embeddings_worker_id_key;

-- Add an angle column to track which angle each embedding represents
ALTER TABLE public.face_embeddings ADD COLUMN IF NOT EXISTS angle TEXT DEFAULT 'front';


-- ========== 20260507045527_190cacb9-8b03-40be-9cbd-d51da8a4998b.sql ==========

ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_worker_date_unique;

ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS regular_hours NUMERIC NOT NULL DEFAULT 0;

UPDATE public.attendance_logs
SET status = CASE WHEN time_out IS NOT NULL THEN 'completed' ELSE 'active' END;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_logs_one_active_per_worker
  ON public.attendance_logs (worker_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_attendance_logs_worker_status
  ON public.attendance_logs (worker_id, status);


-- ========== 20260507050352_b916a096-9c91-477e-b8bd-5a2af0c8524c.sql ==========

-- 1. Make attendance-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'attendance-photos';

-- Drop old public read policy
DROP POLICY IF EXISTS "Attendance photos are publicly readable" ON storage.objects;

-- Add authenticated-only read policy for attendance photos
CREATE POLICY "Authenticated users can view attendance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-photos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  )
);

-- 2. Restrict audit_logs INSERT policy
DROP POLICY IF EXISTS "Users can create audit logs" ON public.audit_logs;

CREATE POLICY "Privileged users can create audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  )
);

-- 3. Make get_all_supervisors raise explicit error for non-admins
CREATE OR REPLACE FUNCTION public.get_all_supervisors()
RETURNS TABLE(id uuid, email text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT au.id, au.email, au.created_at
  FROM auth.users au;
END;
$function$;


-- ========== 20260508052009_a26a58cd-853f-404e-8b0d-9c1d66ec8121.sql ==========

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
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cancelled' AND enumtypid = 'public.project_status'::regtype) THEN
    ALTER TYPE public.project_status ADD VALUE 'cancelled';
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


-- ========== 20260512112347_8968aca6-91dc-41ad-b25f-e18218e83d7f.sql ==========

-- Enums
CREATE TYPE public.checklist_stage AS ENUM ('pre_work','during_work','post_work','quality_check','safety_inspection');
CREATE TYPE public.checklist_type AS ENUM ('pdf','interactive');
CREATE TYPE public.checklist_input_type AS ENUM ('checkbox','text','number','dropdown','photo','signature');
CREATE TYPE public.project_checklist_status AS ENUM ('not_started','in_progress','completed');

-- Methodologies
CREATE TABLE public.methodologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  description text,
  file_path text NOT NULL,
  file_size bigint,
  version text,
  uploaded_by uuid NOT NULL,
  upload_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.methodologies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view methodologies" ON public.methodologies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage methodologies" ON public.methodologies FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::supervisor_role))
  WITH CHECK (has_role(auth.uid(),'admin'::supervisor_role));
CREATE TRIGGER trg_methodologies_updated BEFORE UPDATE ON public.methodologies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checklist templates
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  stage public.checklist_stage,
  description text,
  checklist_type public.checklist_type NOT NULL,
  pdf_path text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view templates" ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage templates" ON public.checklist_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::supervisor_role))
  WITH CHECK (has_role(auth.uid(),'admin'::supervisor_role));
CREATE TRIGGER trg_checklist_templates_updated BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checklist items
CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  item_number int NOT NULL,
  item_text text NOT NULL,
  input_type public.checklist_input_type NOT NULL,
  dropdown_options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  help_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_items_template ON public.checklist_items(template_id);
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view checklist items" ON public.checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage checklist items" ON public.checklist_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::supervisor_role))
  WITH CHECK (has_role(auth.uid(),'admin'::supervisor_role));

-- Project checklists
CREATE TABLE public.project_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE RESTRICT,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status public.project_checklist_status NOT NULL DEFAULT 'not_started',
  assigned_by uuid,
  completed_by uuid,
  completed_at timestamptz,
  overall_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_checklists_project ON public.project_checklists(project_id);
ALTER TABLE public.project_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View project checklists" ON public.project_checklists FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_checklists.project_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))));
CREATE POLICY "Manage project checklists" ON public.project_checklists FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_checklists.project_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_checklists.project_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))));
CREATE TRIGGER trg_project_checklists_updated BEFORE UPDATE ON public.project_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checklist responses
CREATE TABLE public.checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_checklist_id uuid NOT NULL REFERENCES public.project_checklists(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  response_value text,
  response_photos jsonb,
  response_signature text,
  response_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_checklist_id, item_id)
);
CREATE INDEX idx_checklist_responses_pc ON public.checklist_responses(project_checklist_id);
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View checklist responses" ON public.checklist_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_checklists pc JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = checklist_responses.project_checklist_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))));
CREATE POLICY "Manage checklist responses" ON public.checklist_responses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_checklists pc JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = checklist_responses.project_checklist_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_checklists pc JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = checklist_responses.project_checklist_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('methodologies','methodologies', false),
  ('checklist-pdfs','checklist-pdfs', false),
  ('checklist-responses','checklist-responses', false);

-- methodologies bucket: any auth read; admin write
CREATE POLICY "Auth read methodology files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'methodologies');
CREATE POLICY "Admin write methodology files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'methodologies' AND has_role(auth.uid(),'admin'::supervisor_role));
CREATE POLICY "Admin update methodology files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'methodologies' AND has_role(auth.uid(),'admin'::supervisor_role));
CREATE POLICY "Admin delete methodology files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'methodologies' AND has_role(auth.uid(),'admin'::supervisor_role));

-- checklist-pdfs bucket: same admin model
CREATE POLICY "Auth read checklist pdfs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checklist-pdfs');
CREATE POLICY "Admin write checklist pdfs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklist-pdfs' AND has_role(auth.uid(),'admin'::supervisor_role));
CREATE POLICY "Admin update checklist pdfs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'checklist-pdfs' AND has_role(auth.uid(),'admin'::supervisor_role));
CREATE POLICY "Admin delete checklist pdfs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checklist-pdfs' AND has_role(auth.uid(),'admin'::supervisor_role));

-- checklist-responses bucket: any authenticated user (supervisor) can read/write their own contents
CREATE POLICY "Auth read response files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checklist-responses');
CREATE POLICY "Auth insert response files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklist-responses');
CREATE POLICY "Auth update response files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'checklist-responses');
CREATE POLICY "Auth delete response files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checklist-responses');


-- ========== 20260516121932_86f3db54-1088-44fa-b4a2-f83723dfe02f.sql ==========
ALTER TYPE public.supervisor_role ADD VALUE IF NOT EXISTS 'management';


-- ========== 20260516121951_6c51184c-46c4-4331-b16e-764c958077ae.sql ==========

-- Management read-only access across operational tables
CREATE POLICY "Management can view all projects" ON public.projects
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view all activities" ON public.daily_activities
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view all activity workers" ON public.activity_workers
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view all activity photos" ON public.activity_photos
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view all attendance" ON public.attendance_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view all attendance photos" ON public.attendance_photos
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view progress history" ON public.progress_history
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view milestones" ON public.project_milestones
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view project photos" ON public.project_photos
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view project workers" ON public.project_workers
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view project checklists" ON public.project_checklists
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view checklist responses" ON public.checklist_responses
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view supervisor attendance" ON public.supervisor_attendance
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view work notes" ON public.daily_work_notes
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view workers" ON public.workers
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

-- Management can assign checklists to projects (optional per spec)
CREATE POLICY "Management can assign project checklists" ON public.project_checklists
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can update project checklists" ON public.project_checklists
  FOR UPDATE USING (public.has_role(auth.uid(), 'management'));


-- ========== 20260611052859_af7defe7-b82f-4dc1-8bf6-7d45c3fe7a0a.sql ==========
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


-- ========== 20260615093158_5a531398-dc20-40e2-83cd-d610f3ee8ccc.sql ==========
CREATE OR REPLACE FUNCTION public.admin_list_workers_for_deployment()
RETURNS TABLE(
  id uuid,
  full_name text,
  designation text,
  supervisor_id uuid,
  supervisor_email text,
  current_group_id uuid,
  current_group_name text,
  current_site_id uuid,
  current_site_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')) THEN
    RAISE EXCEPTION 'Access denied: admin or management role required';
  END IF;

  RETURN QUERY
  SELECT w.id,
         w.full_name,
         w.designation,
         w.supervisor_id,
         au.email::text AS supervisor_email,
         w.current_group_id,
         g.name AS current_group_name,
         w.current_site_id,
         s.name AS current_site_name
  FROM public.workers w
  LEFT JOIN auth.users au ON au.id = w.supervisor_id
  LEFT JOIN public.worker_groups g ON g.id = w.current_group_id
  LEFT JOIN public.sites s ON s.id = w.current_site_id
  ORDER BY w.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_workers_for_deployment() TO authenticated;


-- ========== 20260724050146_cb6f8b55-6845-4136-8f9a-d32b6b4128f8.sql ==========

ALTER TYPE public.supervisor_role ADD VALUE IF NOT EXISTS 'project_manager';
ALTER TYPE public.supervisor_role ADD VALUE IF NOT EXISTS 'procurement';


-- ========== 20260724050318_69f18826-8f55-4d1a-af0e-9edf2a3b04d5.sql ==========

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


-- ========== 20260728114632_b3239f54-da36-4a3c-8253-644262d8bb97.sql ==========

CREATE POLICY "dpr_reports_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dpr-reports');
CREATE POLICY "dpr_reports_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dpr-reports');
CREATE POLICY "dpr_reports_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'dpr-reports' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'dpr-reports' AND public.has_role(auth.uid(),'admin'));


-- ========== 20260729093659_f3f1647b-02af-451e-a946-8cc84e577b1e.sql ==========

ALTER TABLE public.dpr_reports ADD COLUMN IF NOT EXISTS site_conditions jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.dpr_activities ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.dpr_activities ADD COLUMN IF NOT EXISTS target_reached boolean;
ALTER TABLE public.dpr_activities ADD COLUMN IF NOT EXISTS reason_not_achieved text;


-- ========== 20260730050910_a0ef693c-f957-4946-a036-1129728b34ea.sql ==========
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


-- ========== 20260731042707_4d91c856-c5f9-43de-94a2-a4a1de557c5d.sql ==========
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


-- ========== 20260805060422_af4f5021-1b1a-42c0-98fe-9587a82b0a37.sql ==========
CREATE UNIQUE INDEX IF NOT EXISTS attendance_logs_worker_date_unique
ON public.attendance_logs (worker_id, date);

DROP POLICY IF EXISTS "Supervisors can create attendance logs" ON public.attendance_logs;

CREATE POLICY "Supervisors and admins can create attendance logs"
ON public.attendance_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = supervisor_id
  OR public.has_role(auth.uid(), 'admin'::public.supervisor_role)
);


-- ========== 20260805060715_1fa09180-042f-4528-bc1d-85530ad5e968.sql ==========
DROP INDEX IF EXISTS public.attendance_logs_one_active_per_worker;
DROP INDEX IF EXISTS public.uq_attendance_worker_date;


-- ========== 20260806043157_74398e3c-4213-496b-b6e2-0f72e2d2454c.sql ==========
ALTER TABLE public.material_dispatch_items
  ADD COLUMN IF NOT EXISTS specification text,
  ADD COLUMN IF NOT EXISTS qty_in_factory numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispatched_by text,
  ADD COLUMN IF NOT EXISTS qty_returned numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_by text;

ALTER TABLE public.material_dispatches
  ADD COLUMN IF NOT EXISTS return_date date,
  ADD COLUMN IF NOT EXISTS factory_store_manager text,
  ADD COLUMN IF NOT EXISTS site_incharge text,
  ADD COLUMN IF NOT EXISTS qc_project_manager text,
  ADD COLUMN IF NOT EXISTS return_verified_by text;


-- ========== 20260806043314_703a3fa0-7916-41b6-b42b-afa5e87707ab.sql ==========
ALTER TABLE public.stock_transactions
  ADD COLUMN IF NOT EXISTS transaction_date date NOT NULL DEFAULT CURRENT_DATE;

DROP VIEW IF EXISTS public.project_stock_summary;
CREATE VIEW public.project_stock_summary
WITH (security_invoker = true)
AS
SELECT
  pm.id AS project_material_id,
  pm.project_id,
  pm.name,
  pm.category,
  pm.specification,
  pm.unit,
  pm.stage,
  pm.boq_qty,
  pm.min_stock_level,
  pm.vendor,
  COALESCE(SUM(CASE WHEN st.txn_type IN ('receipt','adjustment') THEN st.qty WHEN st.txn_type = 'usage' THEN -st.qty ELSE 0 END), 0) AS current_stock,
  COALESCE(SUM(CASE WHEN st.txn_type = 'usage' THEN st.qty ELSE 0 END), 0) AS total_used,
  COALESCE(SUM(CASE WHEN st.txn_type = 'receipt' THEN st.qty ELSE 0 END), 0) AS total_received
FROM public.project_materials pm
LEFT JOIN public.stock_transactions st ON st.project_material_id = pm.id
WHERE pm.active = true
GROUP BY pm.id, pm.project_id, pm.name, pm.category, pm.specification, pm.unit, pm.stage, pm.boq_qty, pm.min_stock_level, pm.vendor;

GRANT SELECT ON public.project_stock_summary TO authenticated;
GRANT ALL ON public.project_stock_summary TO service_role;


-- ========== 20260905120511_e0c109c8-36b1-4c30-bdf7-199f36a328c7.sql ==========
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


-- ========== 20260921122830_phase1_company_setup.sql ==========
-- ============================================================
-- Phase 1 â€“ Company Setup & Authentication
-- ============================================================

-- â”€â”€ companies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ company_members â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.company_members (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  role        TEXT    NOT NULL CHECK (role IN ('admin','management','supervisor','worker')),
  is_active   BOOLEAN DEFAULT true,
  joined_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- â”€â”€ user_profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.user_profiles (
  id                UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         TEXT,
  phone             TEXT,
  avatar_url        TEXT,
  active_company_id UUID    REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- â”€â”€ helper: generate unique company code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ helper: generate unique 6-digit join code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ RPC: look up a company by join code (bypasses RLS) â”€â”€â”€â”€â”€
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

-- â”€â”€ auto-create user_profile on new signup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ timestamps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ Indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX idx_company_members_user     ON public.company_members(user_id);
CREATE INDEX idx_company_members_company  ON public.company_members(company_id);
CREATE INDEX idx_companies_join_code      ON public.companies(join_code);
CREATE INDEX idx_companies_company_code   ON public.companies(company_code);
CREATE INDEX idx_user_profiles_phone      ON public.user_profiles(phone);


