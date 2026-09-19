-- Make worker-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'worker-photos';