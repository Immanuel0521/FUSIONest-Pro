-- Fix notifications RLS policy to only allow service role or own notifications
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;

-- Allow only service role (Edge Functions) OR users inserting their own notifications
CREATE POLICY "Service role or own notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  auth.jwt()->>'role' = 'service_role' 
  OR auth.uid() = user_id
);