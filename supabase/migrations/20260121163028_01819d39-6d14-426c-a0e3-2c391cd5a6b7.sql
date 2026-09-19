-- Fix: Restrict activity_types SELECT access to authenticated users only
DROP POLICY IF EXISTS "Anyone can view activity types" ON public.activity_types;

CREATE POLICY "Authenticated users can view activity types"
ON public.activity_types FOR SELECT
TO authenticated
USING (true);