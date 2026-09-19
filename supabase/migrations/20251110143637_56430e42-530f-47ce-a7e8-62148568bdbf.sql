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