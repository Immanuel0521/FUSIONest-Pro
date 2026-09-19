-- Fix storage exposure: Remove public SELECT policy on worker-photos bucket
-- and add authenticated-only access policy

-- Drop the public SELECT policy that allows unauthenticated access
DROP POLICY IF EXISTS "Worker photos are publicly accessible" ON storage.objects;

-- Create a new policy that only allows authenticated users to view worker photos
CREATE POLICY "Authenticated users can view worker photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-photos' AND auth.uid() IS NOT NULL);