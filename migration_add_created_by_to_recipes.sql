-- Add created_by column to recipes table
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_recipes_created_by ON recipes(created_by);

