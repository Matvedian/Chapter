-- Make books table source-agnostic to support Google Books alongside Open Library
ALTER TABLE public.books RENAME COLUMN open_library_id TO external_id;
ALTER TABLE public.books ADD COLUMN source TEXT NOT NULL DEFAULT 'open_library';
ALTER TABLE public.books DROP CONSTRAINT books_open_library_id_key;
ALTER TABLE public.books ADD CONSTRAINT books_source_external_id_key UNIQUE (source, external_id);
