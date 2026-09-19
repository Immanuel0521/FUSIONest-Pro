
-- Management read-only access across operational tables
CREATE POLICY "Management can view all projects" ON public.projects
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view all activities" ON public.daily_activities
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view all activity workers" ON public.activity_workers
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view all activity photos" ON public.activity_photos
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view all attendance" ON public.attendance_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view all attendance photos" ON public.attendance_photos
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view progress history" ON public.progress_history
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view milestones" ON public.project_milestones
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view project photos" ON public.project_photos
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view project workers" ON public.project_workers
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view project checklists" ON public.project_checklists
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view checklist responses" ON public.checklist_responses
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view supervisor attendance" ON public.supervisor_attendance
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view work notes" ON public.daily_work_notes
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can view workers" ON public.workers
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

-- Management can assign checklists to projects (optional per spec)
CREATE POLICY "Management can assign project checklists" ON public.project_checklists
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can update project checklists" ON public.project_checklists
  FOR UPDATE USING (public.has_role(auth.uid(), 'management'));
