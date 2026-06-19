ALTER TABLE public.user_books
  ADD COLUMN IF NOT EXISTS review text;
