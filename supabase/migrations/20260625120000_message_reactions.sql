CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reactions in their matches" ON public.message_reactions;
CREATE POLICY "Users can view reactions in their matches"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.matches mt ON mt.id = m.match_id
      WHERE m.id = message_reactions.message_id
        AND (mt.user1_id = auth.uid() OR mt.user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can add reactions in their matches" ON public.message_reactions;
CREATE POLICY "Users can add reactions in their matches"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.matches mt ON mt.id = m.match_id
      WHERE m.id = message_reactions.message_id
        AND (mt.user1_id = auth.uid() OR mt.user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can remove their own reactions" ON public.message_reactions;
CREATE POLICY "Users can remove their own reactions"
  ON public.message_reactions FOR DELETE
  USING (user_id = auth.uid());

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN others THEN NULL;
END $$;
