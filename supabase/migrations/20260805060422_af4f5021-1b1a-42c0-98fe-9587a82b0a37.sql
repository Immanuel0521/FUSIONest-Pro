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