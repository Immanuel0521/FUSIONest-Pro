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