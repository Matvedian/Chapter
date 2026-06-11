-- Phase 2: book-comment likes + match reason breakdown on candidates

ALTER TABLE public.swipes
  ADD COLUMN IF NOT EXISTS book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comment text;

COMMENT ON COLUMN public.swipes.book_id IS 'Optional favourite book the swiper liked with intent';
COMMENT ON COLUMN public.swipes.comment IS 'Optional note when liking via a specific book';

DROP FUNCTION IF EXISTS public.get_candidates(uuid);

CREATE OR REPLACE FUNCTION public.get_candidates(p_user_id uuid)
 RETURNS TABLE(profile_id uuid, score integer, shared_books integer, shared_genres integer)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    p.id AS profile_id,
    (
      COUNT(DISTINCT ub2.book_id) FILTER (WHERE ub2.book_id IS NOT NULL) * 3 +
      COUNT(DISTINCT ug2.genre_id) FILTER (WHERE ug2.genre_id IS NOT NULL) * 1
    )::int AS score,
    COUNT(DISTINCT ub2.book_id) FILTER (WHERE ub2.book_id IS NOT NULL)::int AS shared_books,
    COUNT(DISTINCT ug2.genre_id) FILTER (WHERE ug2.genre_id IS NOT NULL)::int AS shared_genres
  FROM public.profiles p
  LEFT JOIN public.user_books ub2
    ON ub2.user_id = p.id
    AND ub2.book_id IN (SELECT book_id FROM public.user_books WHERE user_id = p_user_id)
  LEFT JOIN public.user_genres ug2
    ON ug2.user_id = p.id
    AND ug2.genre_id IN (SELECT genre_id FROM public.user_genres WHERE user_id = p_user_id)
  WHERE p.id != p_user_id
    AND p.onboarding_complete = true
    AND p.paused = false
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes
      WHERE swiper_id = p_user_id
        AND swiped_id = p.id
        AND (direction = 'like' OR created_at > now() - interval '30 days')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = p_user_id AND blocked_id = p.id)
         OR (blocker_id = p.id AND blocked_id = p_user_id)
    )
    AND (
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
$function$;
