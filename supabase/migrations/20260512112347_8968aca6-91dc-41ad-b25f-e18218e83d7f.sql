
-- Enums
CREATE TYPE public.checklist_stage AS ENUM ('pre_work','during_work','post_work','quality_check','safety_inspection');
CREATE TYPE public.checklist_type AS ENUM ('pdf','interactive');
CREATE TYPE public.checklist_input_type AS ENUM ('checkbox','text','number','dropdown','photo','signature');
CREATE TYPE public.project_checklist_status AS ENUM ('not_started','in_progress','completed');

-- Methodologies
CREATE TABLE public.methodologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  description text,
  file_path text NOT NULL,
  file_size bigint,
  version text,
  uploaded_by uuid NOT NULL,
  upload_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.methodologies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view methodologies" ON public.methodologies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage methodologies" ON public.methodologies FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::supervisor_role))
  WITH CHECK (has_role(auth.uid(),'admin'::supervisor_role));
CREATE TRIGGER trg_methodologies_updated BEFORE UPDATE ON public.methodologies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checklist templates
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  stage public.checklist_stage,
  description text,
  checklist_type public.checklist_type NOT NULL,
  pdf_path text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view templates" ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage templates" ON public.checklist_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::supervisor_role))
  WITH CHECK (has_role(auth.uid(),'admin'::supervisor_role));
CREATE TRIGGER trg_checklist_templates_updated BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checklist items
CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  item_number int NOT NULL,
  item_text text NOT NULL,
  input_type public.checklist_input_type NOT NULL,
  dropdown_options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  help_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_items_template ON public.checklist_items(template_id);
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view checklist items" ON public.checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage checklist items" ON public.checklist_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::supervisor_role))
  WITH CHECK (has_role(auth.uid(),'admin'::supervisor_role));

-- Project checklists
CREATE TABLE public.project_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE RESTRICT,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status public.project_checklist_status NOT NULL DEFAULT 'not_started',
  assigned_by uuid,
  completed_by uuid,
  completed_at timestamptz,
  overall_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_checklists_project ON public.project_checklists(project_id);
ALTER TABLE public.project_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View project checklists" ON public.project_checklists FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_checklists.project_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))));
CREATE POLICY "Manage project checklists" ON public.project_checklists FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_checklists.project_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_checklists.project_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))));
CREATE TRIGGER trg_project_checklists_updated BEFORE UPDATE ON public.project_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checklist responses
CREATE TABLE public.checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_checklist_id uuid NOT NULL REFERENCES public.project_checklists(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  response_value text,
  response_photos jsonb,
  response_signature text,
  response_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_checklist_id, item_id)
);
CREATE INDEX idx_checklist_responses_pc ON public.checklist_responses(project_checklist_id);
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View checklist responses" ON public.checklist_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_checklists pc JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = checklist_responses.project_checklist_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))));
CREATE POLICY "Manage checklist responses" ON public.checklist_responses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_checklists pc JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = checklist_responses.project_checklist_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_checklists pc JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = checklist_responses.project_checklist_id
    AND (p.supervisor_id = auth.uid() OR has_role(auth.uid(),'admin'::supervisor_role))));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('methodologies','methodologies', false),
  ('checklist-pdfs','checklist-pdfs', false),
  ('checklist-responses','checklist-responses', false);

-- methodologies bucket: any auth read; admin write
CREATE POLICY "Auth read methodology files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'methodologies');
CREATE POLICY "Admin write methodology files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'methodologies' AND has_role(auth.uid(),'admin'::supervisor_role));
CREATE POLICY "Admin update methodology files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'methodologies' AND has_role(auth.uid(),'admin'::supervisor_role));
CREATE POLICY "Admin delete methodology files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'methodologies' AND has_role(auth.uid(),'admin'::supervisor_role));

-- checklist-pdfs bucket: same admin model
CREATE POLICY "Auth read checklist pdfs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checklist-pdfs');
CREATE POLICY "Admin write checklist pdfs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklist-pdfs' AND has_role(auth.uid(),'admin'::supervisor_role));
CREATE POLICY "Admin update checklist pdfs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'checklist-pdfs' AND has_role(auth.uid(),'admin'::supervisor_role));
CREATE POLICY "Admin delete checklist pdfs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checklist-pdfs' AND has_role(auth.uid(),'admin'::supervisor_role));

-- checklist-responses bucket: any authenticated user (supervisor) can read/write their own contents
CREATE POLICY "Auth read response files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checklist-responses');
CREATE POLICY "Auth insert response files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklist-responses');
CREATE POLICY "Auth update response files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'checklist-responses');
CREATE POLICY "Auth delete response files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checklist-responses');
