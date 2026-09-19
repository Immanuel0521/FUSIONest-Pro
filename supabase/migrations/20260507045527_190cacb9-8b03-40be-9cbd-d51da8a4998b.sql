
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
