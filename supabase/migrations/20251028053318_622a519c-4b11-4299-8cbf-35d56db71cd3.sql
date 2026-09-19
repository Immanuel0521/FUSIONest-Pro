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