-- Shelf enum type
CREATE TYPE shelf_type AS ENUM ('reading', 'read', 'want_to_read', 'favorite');

-- User books table (reading lists)
CREATE TABLE user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  shelf shelf_type NOT NULL DEFAULT 'want_to_read',
  rating INT CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Enable RLS
ALTER TABLE user_books ENABLE ROW LEVEL SECURITY;

-- User books are viewable by everyone (for matching)
CREATE POLICY "User books are viewable by everyone" ON user_books
  FOR SELECT USING (true);

-- Users can manage their own books
CREATE POLICY "Users can insert their own books" ON user_books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books" ON user_books
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books" ON user_books
  FOR DELETE USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_user_books_user_id ON user_books(user_id);
CREATE INDEX idx_user_books_shelf ON user_books(shelf);
