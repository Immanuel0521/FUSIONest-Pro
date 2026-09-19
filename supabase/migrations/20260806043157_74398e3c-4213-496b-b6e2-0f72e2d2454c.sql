ALTER TABLE public.material_dispatch_items
  ADD COLUMN IF NOT EXISTS specification text,
  ADD COLUMN IF NOT EXISTS qty_in_factory numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispatched_by text,
  ADD COLUMN IF NOT EXISTS qty_returned numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_by text;

ALTER TABLE public.material_dispatches
  ADD COLUMN IF NOT EXISTS return_date date,
  ADD COLUMN IF NOT EXISTS factory_store_manager text,
  ADD COLUMN IF NOT EXISTS site_incharge text,
  ADD COLUMN IF NOT EXISTS qc_project_manager text,
  ADD COLUMN IF NOT EXISTS return_verified_by text;