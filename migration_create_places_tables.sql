-- Create places table for Tip Jar locations
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  url TEXT,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'unrated' CHECK (status IN ('visited', 'want', 'unrated')),
  cuisine_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create lists to group imported places
CREATE TABLE IF NOT EXISTS place_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'imported',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link places to lists with optional notes
CREATE TABLE IF NOT EXISTS place_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES place_lists(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT place_list_items_unique UNIQUE (list_id, place_id)
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_places_google_place_id ON places(google_place_id);
CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);
CREATE INDEX IF NOT EXISTS idx_places_lat_lng ON places(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_place_list_items_list_id ON place_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_place_list_items_place_id ON place_list_items(place_id);


