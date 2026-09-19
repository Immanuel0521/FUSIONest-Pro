-- Add new columns to workers table
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS date_of_joining DATE,
ADD COLUMN IF NOT EXISTS designation TEXT;

-- Create storage bucket for worker photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-photos', 'worker-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for worker photos
CREATE POLICY "Worker photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-photos');

CREATE POLICY "Supervisors can upload worker photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'worker-photos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Supervisors can update worker photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'worker-photos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Supervisors can delete worker photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'worker-photos' 
  AND auth.uid() IS NOT NULL
);