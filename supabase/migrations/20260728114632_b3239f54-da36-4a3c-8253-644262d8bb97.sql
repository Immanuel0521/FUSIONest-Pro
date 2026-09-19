
CREATE POLICY "dpr_reports_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dpr-reports');
CREATE POLICY "dpr_reports_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dpr-reports');
CREATE POLICY "dpr_reports_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'dpr-reports' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'dpr-reports' AND public.has_role(auth.uid(),'admin'));
