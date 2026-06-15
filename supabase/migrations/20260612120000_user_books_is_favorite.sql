-- Favourites become a flag; shelf is only reading / read / want_to_read.

ALTER TABLE public.user_books
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

UPDATE public.user_books
SET is_favorite = true
WHERE shelf = 'favorite';

UPDATE public.user_books
SET shelf = 'read'
WHERE shelf = 'favorite';

CREATE INDEX IF NOT EXISTS idx_user_books_is_favorite ON public.user_books(user_id, is_favorite)
  WHERE is_favorite = true;
