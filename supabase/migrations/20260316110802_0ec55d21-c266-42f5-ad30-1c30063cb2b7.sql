
-- Remove the unique constraint on worker_id to allow multiple face embeddings per worker (front, left, right angles)
ALTER TABLE public.face_embeddings DROP CONSTRAINT IF EXISTS face_embeddings_worker_id_key;

-- Add an angle column to track which angle each embedding represents
ALTER TABLE public.face_embeddings ADD COLUMN IF NOT EXISTS angle TEXT DEFAULT 'front';
