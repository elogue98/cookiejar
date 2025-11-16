-- Add cookbookSource column to recipes table
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS cookbookSource TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN recipes.cookbookSource IS 'Optional cookbook name and page number for recipes imported from cookbooks';

