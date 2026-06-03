-- Books table (cached from Open Library)
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_library_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  cover_url TEXT,
  genres TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- Books are readable by everyone
CREATE POLICY "Books are viewable by everyone" ON books
  FOR SELECT USING (true);

-- Authenticated users can insert books
CREATE POLICY "Authenticated users can insert books" ON books
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
