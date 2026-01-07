-- Create place_ratings table mirroring recipe ratings
CREATE TABLE IF NOT EXISTS place_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_place_ratings_place_id ON place_ratings(place_id);
CREATE INDEX IF NOT EXISTS idx_place_ratings_user_id ON place_ratings(user_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION place_ratings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_place_ratings_updated_at
  BEFORE UPDATE ON place_ratings
  FOR EACH ROW
  EXECUTE FUNCTION place_ratings_set_updated_at();


