
-- Add unique constraint on (worker_id, date) to enforce one record per worker per day
ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_worker_date_unique UNIQUE (worker_id, date);
