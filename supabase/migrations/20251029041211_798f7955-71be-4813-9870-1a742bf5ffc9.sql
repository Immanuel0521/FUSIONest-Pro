-- Create backups storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for backups bucket (admin only)
CREATE POLICY "Admins can upload backups"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'backups' 
  AND has_role(auth.uid(), 'admin'::supervisor_role)
);

CREATE POLICY "Admins can view backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups' 
  AND has_role(auth.uid(), 'admin'::supervisor_role)
);

CREATE POLICY "Admins can download backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups' 
  AND has_role(auth.uid(), 'admin'::supervisor_role)
);

CREATE POLICY "Admins can delete backups"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'backups' 
  AND has_role(auth.uid(), 'admin'::supervisor_role)
);