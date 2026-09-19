-- Create daily_work_notes table for work allocation tracking
CREATE TABLE public.daily_work_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT NOT NULL,
  location TEXT,
  worker_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.daily_work_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supervisors to manage their own notes
CREATE POLICY "Supervisors can view their own notes"
  ON public.daily_work_notes
  FOR SELECT
  USING (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can create their own notes"
  ON public.daily_work_notes
  FOR INSERT
  WITH CHECK (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can update their own notes"
  ON public.daily_work_notes
  FOR UPDATE
  USING (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can delete their own notes"
  ON public.daily_work_notes
  FOR DELETE
  USING (auth.uid() = supervisor_id);

-- Admins can view all notes
CREATE POLICY "Admins can view all notes"
  ON public.daily_work_notes
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_daily_work_notes_updated_at
  BEFORE UPDATE ON public.daily_work_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();