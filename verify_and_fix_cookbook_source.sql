-- First, verify if the column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'recipes' 
  AND column_name = 'cookbookSource';

-- If the column doesn't exist, add it (this will work even if it already exists)
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS cookbookSource TEXT;

-- Verify it was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'recipes' 
  AND column_name = 'cookbookSource';

