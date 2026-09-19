
-- Create storage bucket for attendance photos
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow supervisors to upload attendance photos
CREATE POLICY "Supervisors can upload attendance photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'attendance-photos'
  AND auth.role() = 'authenticated'
);

-- Public read access for attendance photos
CREATE POLICY "Attendance photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'attendance-photos');

-- Admins can delete attendance photos
CREATE POLICY "Admins can delete attendance photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'attendance-photos'
  AND public.has_role(auth.uid(), 'admin')
);

-- Enable pg_cron and pg_net for auto-cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
