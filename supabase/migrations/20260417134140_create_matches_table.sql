-- Matches table (created when both users like each other)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id) -- Ensure consistent ordering
);

-- Enable RLS
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Users can see their own matches
CREATE POLICY "Users can see their matches" ON matches
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- System creates matches (via function), but we allow insert for the trigger
CREATE POLICY "Authenticated users can create matches" ON matches
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Index for faster queries
CREATE INDEX idx_matches_user1 ON matches(user1_id);
CREATE INDEX idx_matches_user2 ON matches(user2_id);

-- Function to check and create match on mutual like
CREATE OR REPLACE FUNCTION check_and_create_match()
RETURNS TRIGGER AS $$
DECLARE
  mutual_like_exists BOOLEAN;
  ordered_user1 UUID;
  ordered_user2 UUID;
BEGIN
  -- Check if the other person has already liked us
  SELECT EXISTS (
    SELECT 1 FROM likes
    WHERE from_user_id = NEW.to_user_id
    AND to_user_id = NEW.from_user_id
  ) INTO mutual_like_exists;

  IF mutual_like_exists THEN
    -- Order the IDs consistently
    IF NEW.from_user_id < NEW.to_user_id THEN
      ordered_user1 := NEW.from_user_id;
      ordered_user2 := NEW.to_user_id;
    ELSE
      ordered_user1 := NEW.to_user_id;
      ordered_user2 := NEW.from_user_id;
    END IF;

    -- Create match if it doesn't exist
    INSERT INTO matches (user1_id, user2_id)
    VALUES (ordered_user1, ordered_user2)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create matches
CREATE TRIGGER on_like_check_match
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION check_and_create_match();
