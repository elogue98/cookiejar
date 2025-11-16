-- Verify the cookbookSource column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'recipes' 
  AND column_name = 'cookbookSource';

-- If the above returns no rows, try checking with different case
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'recipes' 
  AND column_name ILIKE 'cookbook%';

