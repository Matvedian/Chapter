-- Pass swipes older than 30 days are excluded from the NOT EXISTS filter,
-- so those profiles re-enter the swipe deck instead of disappearing forever.
-- Likes are always excluded regardless of age.
CREATE OR REPLACE FUNCTION public.get_candidates(p_user_id uuid)
 RETURNS TABLE(profile_id uuid, score integer)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
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
      WHERE swiper_id = p_user_id
        AND swiped_id = p.id
        AND (direction = 'like' OR created_at > now() - interval '30 days')
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
$function$
