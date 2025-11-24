-- Create recipe_versions table
CREATE TABLE IF NOT EXISTS recipe_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  field_changed TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  description TEXT
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe_id ON recipe_versions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_user_id ON recipe_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_timestamp ON recipe_versions(timestamp DESC);

