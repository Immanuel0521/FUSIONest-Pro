ALTER TABLE public.stock_transactions
  ADD COLUMN IF NOT EXISTS transaction_date date NOT NULL DEFAULT CURRENT_DATE;

DROP VIEW IF EXISTS public.project_stock_summary;
CREATE VIEW public.project_stock_summary
WITH (security_invoker = true)
AS
SELECT
  pm.id AS project_material_id,
  pm.project_id,
  pm.name,
  pm.category,
  pm.specification,
  pm.unit,
  pm.stage,
  pm.boq_qty,
  pm.min_stock_level,
  pm.vendor,
  COALESCE(SUM(CASE WHEN st.txn_type IN ('receipt','adjustment') THEN st.qty WHEN st.txn_type = 'usage' THEN -st.qty ELSE 0 END), 0) AS current_stock,
  COALESCE(SUM(CASE WHEN st.txn_type = 'usage' THEN st.qty ELSE 0 END), 0) AS total_used,
  COALESCE(SUM(CASE WHEN st.txn_type = 'receipt' THEN st.qty ELSE 0 END), 0) AS total_received
FROM public.project_materials pm
LEFT JOIN public.stock_transactions st ON st.project_material_id = pm.id
WHERE pm.active = true
GROUP BY pm.id, pm.project_id, pm.name, pm.category, pm.specification, pm.unit, pm.stage, pm.boq_qty, pm.min_stock_level, pm.vendor;

GRANT SELECT ON public.project_stock_summary TO authenticated;
GRANT ALL ON public.project_stock_summary TO service_role;