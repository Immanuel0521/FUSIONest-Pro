-- Add monitored_by column to track supervisor names at each site
ALTER TABLE public.daily_work_notes 
ADD COLUMN monitored_by TEXT;