CREATE TABLE public.platform_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at timestamptz,
  connected_at timestamptz DEFAULT now(),
  UNIQUE (user_id, platform)
);
ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own connections" ON public.platform_connections
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
