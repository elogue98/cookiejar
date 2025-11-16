-- Try adding with explicit case handling
-- First, drop if exists (be careful!)
-- ALTER TABLE recipes DROP COLUMN IF EXISTS "cookbookSource";
-- ALTER TABLE recipes DROP COLUMN IF EXISTS cookbookSource;

-- Add the column (PostgreSQL will lowercase unquoted identifiers)
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS cookbookSource TEXT;

-- Verify it exists
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'recipes' 
  AND LOWER(column_name) = 'cookbooksource';

