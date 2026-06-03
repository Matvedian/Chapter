-- Likes table
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id),
  CHECK (from_user_id != to_user_id)
);

-- Enable RLS
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Users can see likes they sent or received
CREATE POLICY "Users can see their own likes" ON likes
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can insert their own likes
CREATE POLICY "Users can insert likes" ON likes
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- Users can delete their own likes
CREATE POLICY "Users can delete their likes" ON likes
  FOR DELETE USING (auth.uid() = from_user_id);

-- Index for faster queries
CREATE INDEX idx_likes_from_user ON likes(from_user_id);
CREATE INDEX idx_likes_to_user ON likes(to_user_id);
