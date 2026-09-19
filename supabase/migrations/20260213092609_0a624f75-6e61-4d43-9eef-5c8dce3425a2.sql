
-- Table for storing face attendance photos for admin review
CREATE TABLE public.attendance_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.attendance_logs(id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'checkin' CHECK (photo_type IN ('checkin', 'checkout')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  approved BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_photos ENABLE ROW LEVEL SECURITY;

-- Admins can see all photos
CREATE POLICY "Admins can view all attendance photos"
ON public.attendance_photos FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Supervisors can see their workers' photos
CREATE POLICY "Supervisors can view their workers photos"
ON public.attendance_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = attendance_photos.worker_id
    AND w.supervisor_id = auth.uid()
  )
);

-- Supervisors can insert photos for their workers
CREATE POLICY "Supervisors can insert attendance photos"
ON public.attendance_photos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = attendance_photos.worker_id
    AND (w.supervisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Admins can update (approve) photos
CREATE POLICY "Admins can update attendance photos"
ON public.attendance_photos FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete photos
CREATE POLICY "Admins can delete attendance photos"
ON public.attendance_photos FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Index for quick lookups
CREATE INDEX idx_attendance_photos_worker_date ON public.attendance_photos(worker_id, date);
CREATE INDEX idx_attendance_photos_approved ON public.attendance_photos(approved, approved_at);
