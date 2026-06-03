-- blocks table
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

alter table public.blocks enable row level security;

create policy "users can insert own blocks" on public.blocks
  for insert with check (auth.uid() = blocker_id);

create policy "users can delete own blocks" on public.blocks
  for delete using (auth.uid() = blocker_id);

create policy "users can read own blocks" on public.blocks
  for select using (auth.uid() = blocker_id);

-- reports table
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "users can insert own reports" on public.reports
  for insert with check (auth.uid() = reporter_id);

-- update get_candidates to exclude blocked users (both directions)
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
$function$
