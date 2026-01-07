-- Update places.status check to allow unrated/visited/want
ALTER TABLE places
  DROP CONSTRAINT IF EXISTS places_status_check,
  ADD CONSTRAINT places_status_check
    CHECK (status IN ('visited', 'want', 'unrated'));


