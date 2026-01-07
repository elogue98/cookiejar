-- Change rating column to allow decimals (NUMERIC/DECIMAL)
-- We'll use DECIMAL(3, 1) to allow up to 10.0 (though technically 99.9, the check constraint will limit it)

ALTER TABLE place_ratings 
  ALTER COLUMN rating TYPE DECIMAL(3, 1);

-- Drop the old constraint
ALTER TABLE place_ratings 
  DROP CONSTRAINT IF EXISTS place_ratings_rating_check;

-- Add new constraint for 0-10 range (or 1-10, keeping consistent with 1-10 but allowing decimals)
-- User asked for "8.5", so decimals are needed. 
-- Usually ratings are 1-10 or 0-10. Existing was 1-10.
ALTER TABLE place_ratings 
  ADD CONSTRAINT place_ratings_rating_check CHECK (rating >= 1 AND rating <= 10);

