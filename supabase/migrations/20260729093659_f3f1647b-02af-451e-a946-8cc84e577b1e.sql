
ALTER TABLE public.dpr_reports ADD COLUMN IF NOT EXISTS site_conditions jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.dpr_activities ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.dpr_activities ADD COLUMN IF NOT EXISTS target_reached boolean;
ALTER TABLE public.dpr_activities ADD COLUMN IF NOT EXISTS reason_not_achieved text;
