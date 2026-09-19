-- Add salary and OT rate fields to workers table
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ot_rate_per_hour NUMERIC DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.workers.monthly_salary IS 'Monthly salary amount in base currency';
COMMENT ON COLUMN public.workers.ot_rate_per_hour IS 'Overtime rate per hour in base currency';