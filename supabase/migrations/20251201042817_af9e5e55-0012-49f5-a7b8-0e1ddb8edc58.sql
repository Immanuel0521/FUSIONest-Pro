-- Add notes_in and notes_out fields to attendance_logs
ALTER TABLE public.attendance_logs
ADD COLUMN notes_in TEXT,
ADD COLUMN notes_out TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.attendance_logs.notes_in IS 'Notes entered by supervisor during check-in';
COMMENT ON COLUMN public.attendance_logs.notes_out IS 'Notes entered by supervisor during check-out';