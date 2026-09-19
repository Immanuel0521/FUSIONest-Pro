CREATE OR REPLACE FUNCTION public.admin_list_workers_for_deployment()
RETURNS TABLE(
  id uuid,
  full_name text,
  designation text,
  supervisor_id uuid,
  supervisor_email text,
  current_group_id uuid,
  current_group_name text,
  current_site_id uuid,
  current_site_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')) THEN
    RAISE EXCEPTION 'Access denied: admin or management role required';
  END IF;

  RETURN QUERY
  SELECT w.id,
         w.full_name,
         w.designation,
         w.supervisor_id,
         au.email::text AS supervisor_email,
         w.current_group_id,
         g.name AS current_group_name,
         w.current_site_id,
         s.name AS current_site_name
  FROM public.workers w
  LEFT JOIN auth.users au ON au.id = w.supervisor_id
  LEFT JOIN public.worker_groups g ON g.id = w.current_group_id
  LEFT JOIN public.sites s ON s.id = w.current_site_id
  ORDER BY w.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_workers_for_deployment() TO authenticated;