
-- Fix 1: Replace overly permissive activity-photos storage DELETE policy
DROP POLICY IF EXISTS "Users can delete their activity photos" ON storage.objects;

CREATE POLICY "Supervisors can delete their own activity photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'activity-photos' 
  AND EXISTS (
    SELECT 1 FROM public.activity_photos ap
    JOIN public.daily_activities da ON da.id = ap.daily_activity_id
    WHERE ap.photo_url LIKE '%' || storage.objects.name
    AND (da.supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.supervisor_role))
  )
);

-- Fix 2: Replace overly permissive worker_auth SELECT policy
DROP POLICY IF EXISTS "Workers can view their own auth" ON public.worker_auth;

-- Only supervisors can view their own workers' auth (without exposing pin_code directly)
CREATE POLICY "Supervisors view their workers auth"
ON public.worker_auth FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = worker_auth.worker_id
    AND (w.supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.supervisor_role))
  )
);

-- Fix 3: Hash existing plaintext PIN codes using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to verify worker PINs securely (SECURITY DEFINER so it bypasses RLS)
CREATE OR REPLACE FUNCTION public.verify_worker_pin(p_worker_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.worker_auth
    WHERE worker_id = p_worker_id
    AND pin_code = crypt(p_pin, pin_code)
  );
END;
$$;

-- Create a function to set a hashed PIN
CREATE OR REPLACE FUNCTION public.set_worker_pin(p_worker_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.worker_auth
  SET pin_code = crypt(p_pin, gen_salt('bf', 8)),
      updated_at = now()
  WHERE worker_id = p_worker_id;
  RETURN FOUND;
END;
$$;

-- Hash all existing plaintext PINs (those not already hashed - bcrypt hashes start with $2)
UPDATE public.worker_auth
SET pin_code = crypt(pin_code, gen_salt('bf', 8))
WHERE pin_code IS NOT NULL 
AND pin_code != ''
AND pin_code NOT LIKE '$2%';
