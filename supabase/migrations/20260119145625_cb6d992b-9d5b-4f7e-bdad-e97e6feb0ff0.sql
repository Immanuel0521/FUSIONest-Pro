-- Create fingerprint templates table for USB fingerprint scanner data
CREATE TABLE public.fingerprint_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  template_data TEXT NOT NULL, -- Base64 encoded fingerprint template from USB scanner
  finger_index INTEGER NOT NULL DEFAULT 1, -- 1-10 representing which finger
  quality_score INTEGER, -- Quality score from scanner (0-100)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL, -- supervisor who registered the fingerprint
  UNIQUE(worker_id, finger_index)
);

-- Enable RLS
ALTER TABLE public.fingerprint_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for fingerprint templates
CREATE POLICY "Admins can manage all fingerprint templates"
ON public.fingerprint_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::supervisor_role));

CREATE POLICY "Supervisors can view their workers fingerprints"
ON public.fingerprint_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workers 
    WHERE workers.id = fingerprint_templates.worker_id 
    AND workers.supervisor_id = auth.uid()
  )
);

CREATE POLICY "Supervisors can manage their workers fingerprints"
ON public.fingerprint_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workers 
    WHERE workers.id = fingerprint_templates.worker_id 
    AND workers.supervisor_id = auth.uid()
  )
);

CREATE POLICY "Supervisors can update their workers fingerprints"
ON public.fingerprint_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workers 
    WHERE workers.id = fingerprint_templates.worker_id 
    AND workers.supervisor_id = auth.uid()
  )
);

CREATE POLICY "Supervisors can delete their workers fingerprints"
ON public.fingerprint_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workers 
    WHERE workers.id = fingerprint_templates.worker_id 
    AND workers.supervisor_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_fingerprint_templates_worker ON public.fingerprint_templates(worker_id);

-- Add trigger for updating updated_at
CREATE TRIGGER update_fingerprint_templates_updated_at
BEFORE UPDATE ON public.fingerprint_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();