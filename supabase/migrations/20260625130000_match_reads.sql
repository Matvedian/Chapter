CREATE TABLE IF NOT EXISTS public.match_reads (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

ALTER TABLE public.match_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reads for their matches" ON public.match_reads;
CREATE POLICY "Users can view reads for their matches"
  ON public.match_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own read" ON public.match_reads;
CREATE POLICY "Users can insert their own read"
  ON public.match_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own read" ON public.match_reads;
CREATE POLICY "Users can update their own read"
  ON public.match_reads FOR UPDATE
  USING (user_id = auth.uid());

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.match_reads;
EXCEPTION WHEN others THEN NULL;
END $$;
