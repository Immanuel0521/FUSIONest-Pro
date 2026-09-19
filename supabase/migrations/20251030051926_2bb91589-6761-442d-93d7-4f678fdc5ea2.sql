-- Add new columns to attendance_logs table for enhanced attendance tracking
ALTER TABLE attendance_logs 
ADD COLUMN IF NOT EXISTS time_out timestamp with time zone,
ADD COLUMN IF NOT EXISTS total_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_exit boolean DEFAULT false;

-- Add comment to describe the columns
COMMENT ON COLUMN attendance_logs.time_out IS 'Exit/checkout time of the worker';
COMMENT ON COLUMN attendance_logs.total_hours IS 'Total working hours calculated from time_in to time_out';
COMMENT ON COLUMN attendance_logs.early_exit IS 'Whether worker left before shift end time';