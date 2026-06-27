CREATE TABLE IF NOT EXISTS public.profile_prompts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  position smallint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, question)
);

ALTER TABLE public.profile_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prompts readable by authenticated users" ON public.profile_prompts;
CREATE POLICY "Prompts readable by authenticated users"
  ON public.profile_prompts FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can manage their own prompts" ON public.profile_prompts;
CREATE POLICY "Users can manage their own prompts"
  ON public.profile_prompts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
