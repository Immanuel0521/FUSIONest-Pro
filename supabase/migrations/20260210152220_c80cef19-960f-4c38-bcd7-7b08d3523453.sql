
-- Add source tracking columns to attendance_logs
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS checkin_source text DEFAULT 'manual';
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS checkout_source text;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS recorded_by text;
