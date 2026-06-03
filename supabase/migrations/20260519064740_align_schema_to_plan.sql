
-- 1. Extend profiles with missing MVP columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS location_country text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS looking_for text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- 2. Rename likes → swipes and add direction support
ALTER TABLE public.likes RENAME TO swipes;
ALTER TABLE public.swipes RENAME COLUMN from_user_id TO swiper_id;
ALTER TABLE public.swipes RENAME COLUMN to_user_id TO swiped_id;
ALTER TABLE public.swipes
  ADD COLUMN IF NOT EXISTS direction text CHECK (direction IN ('like', 'pass')) DEFAULT 'like';
ALTER TABLE public.swipes
  ADD CONSTRAINT swipes_unique_pair UNIQUE (swiper_id, swiped_id);

-- 3. Genres lookup table
CREATE TABLE IF NOT EXISTS public.genres (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL
);
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "genres_public_read" ON public.genres FOR SELECT USING (true);

-- 4. User ↔ genre join table
CREATE TABLE IF NOT EXISTS public.user_genres (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  genre_id int REFERENCES public.genres(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, genre_id)
);
ALTER TABLE public.user_genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_genres_own" ON public.user_genres
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Seed genres
INSERT INTO public.genres (name) VALUES
  ('Fiction'), ('Non-Fiction'), ('Mystery'), ('Thriller'), ('Romance'),
  ('Science Fiction'), ('Fantasy'), ('Horror'), ('Historical Fiction'),
  ('Biography'), ('Self-Help'), ('Poetry'), ('Graphic Novel'),
  ('Young Adult'), ('Children''s'), ('Philosophy'), ('Psychology'),
  ('Science'), ('Travel'), ('Cooking')
ON CONFLICT (name) DO NOTHING;

-- 6. RLS policies for swipes (own rows only)
CREATE POLICY "swipes_insert_own" ON public.swipes
  FOR INSERT WITH CHECK (auth.uid() = swiper_id);
CREATE POLICY "swipes_select_own" ON public.swipes
  FOR SELECT USING (auth.uid() = swiper_id OR auth.uid() = swiped_id);

-- 7. Match trigger: auto-create match on mutual like
CREATE OR REPLACE FUNCTION public.handle_mutual_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.direction = 'like' AND EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = NEW.swiped_id
      AND swiped_id = NEW.swiper_id
      AND direction = 'like'
  ) THEN
    INSERT INTO public.matches (user1_id, user2_id)
    VALUES (LEAST(NEW.swiper_id, NEW.swiped_id), GREATEST(NEW.swiper_id, NEW.swiped_id))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_mutual_like ON public.swipes;
CREATE TRIGGER on_mutual_like
  AFTER INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.handle_mutual_like();

-- 8. Candidate scoring function
CREATE OR REPLACE FUNCTION public.get_candidates(p_user_id uuid)
RETURNS TABLE (
  profile_id uuid,
  score int
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    p.id AS profile_id,
    (
      COUNT(DISTINCT ub2.book_id) FILTER (WHERE ub2.book_id IS NOT NULL) * 3 +
      COUNT(DISTINCT ug2.genre_id) FILTER (WHERE ug2.genre_id IS NOT NULL) * 1
    )::int AS score
  FROM public.profiles p
  LEFT JOIN public.user_books ub2
    ON ub2.user_id = p.id
    AND ub2.book_id IN (SELECT book_id FROM public.user_books WHERE user_id = p_user_id)
  LEFT JOIN public.user_genres ug2
    ON ug2.user_id = p.id
    AND ug2.genre_id IN (SELECT genre_id FROM public.user_genres WHERE user_id = p_user_id)
  WHERE p.id != p_user_id
    AND p.onboarding_complete = true
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes
      WHERE swiper_id = p_user_id AND swiped_id = p.id
    )
    AND (
      -- gender preference matching
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = p_user_id
          AND (me.looking_for IS NULL OR me.looking_for = '{}'
               OR p.gender = ANY(me.looking_for))
          AND (p.looking_for IS NULL OR p.looking_for = '{}'
               OR me.gender = ANY(p.looking_for))
      )
    )
  GROUP BY p.id
  ORDER BY score DESC;
$$;
