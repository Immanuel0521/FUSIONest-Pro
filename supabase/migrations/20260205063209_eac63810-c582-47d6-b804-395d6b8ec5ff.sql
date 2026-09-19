-- Fix: Restrict face embeddings access to supervisors of workers and admins only
-- This prevents any authenticated user from reading all biometric data

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view face embeddings" ON public.face_embeddings;

-- Create a properly scoped SELECT policy
CREATE POLICY "Supervisors can view their workers face data"
ON public.face_embeddings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = face_embeddings.worker_id
    AND (w.supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'::supervisor_role))
  )
);