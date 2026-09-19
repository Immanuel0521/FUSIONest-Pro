
-- 1. Make attendance-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'attendance-photos';

-- Drop old public read policy
DROP POLICY IF EXISTS "Attendance photos are publicly readable" ON storage.objects;

-- Add authenticated-only read policy for attendance photos
CREATE POLICY "Authenticated users can view attendance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-photos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  )
);

-- 2. Restrict audit_logs INSERT policy
DROP POLICY IF EXISTS "Users can create audit logs" ON public.audit_logs;

CREATE POLICY "Privileged users can create audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  )
);

-- 3. Make get_all_supervisors raise explicit error for non-admins
CREATE OR REPLACE FUNCTION public.get_all_supervisors()
RETURNS TABLE(id uuid, email text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT au.id, au.email, au.created_at
  FROM auth.users au;
END;
$function$;
