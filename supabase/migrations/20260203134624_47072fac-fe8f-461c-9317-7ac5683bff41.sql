-- Create face_embeddings table to store face data for recognition
CREATE TABLE public.face_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  embedding_data JSONB NOT NULL, -- Store face descriptor array
  photo_url TEXT, -- Reference photo used for registration
  quality_score NUMERIC(5,2), -- Confidence/quality of the embedding
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(worker_id)
);

-- Add location columns to attendance_logs for GPS tracking
ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS location_in JSONB, -- {lat, lng, accuracy}
ADD COLUMN IF NOT EXISTS location_out JSONB,
ADD COLUMN IF NOT EXISTS face_verified_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS face_verified_out BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS face_confidence_in NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS face_confidence_out NUMERIC(5,2);

-- Enable RLS on face_embeddings
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;

-- Policies for face_embeddings
CREATE POLICY "Authenticated users can view face embeddings"
  ON public.face_embeddings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and supervisors can manage face embeddings"
  ON public.face_embeddings FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );

-- Create worker_auth table for worker login (face-only, no password)
CREATE TABLE public.worker_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE UNIQUE,
  pin_code TEXT, -- Optional 4-digit PIN for extra security
  last_login TIMESTAMPTZ,
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  consent_given BOOLEAN DEFAULT false,
  consent_given_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_auth ENABLE ROW LEVEL SECURITY;

-- Workers can read their own auth record
CREATE POLICY "Workers can view their own auth"
  ON public.worker_auth FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/supervisors can manage worker auth
CREATE POLICY "Admins can manage worker auth"
  ON public.worker_auth FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );

-- Create audit_logs table for admin actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can insert audit logs
CREATE POLICY "Users can create audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_face_embeddings_updated_at
  BEFORE UPDATE ON public.face_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_auth_updated_at
  BEFORE UPDATE ON public.worker_auth
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();