-- Add 'cancelled' value to public.project_status enum if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'cancelled' 
      AND enumtypid = 'public.project_status'::regtype
  ) THEN
    ALTER TYPE public.project_status ADD VALUE 'cancelled';
  END IF;
END$$;
