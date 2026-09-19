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