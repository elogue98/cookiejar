-- Add metadata fields to recipes table for servings, cooking times, and nutrition
-- This replaces storing all metadata as text in the notes field

-- Add servings field
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS servings INTEGER;

-- Add time fields
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS prep_time TEXT;

ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS cook_time TEXT;

ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS total_time TEXT;

-- Add cuisine and meal type
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS cuisine TEXT;

ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS meal_type TEXT;

-- Add nutrition fields (per serving)
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS calories INTEGER;

ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS protein_grams DECIMAL(10, 1);

ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS fat_grams DECIMAL(10, 1);

ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS carbs_grams DECIMAL(10, 1);

-- Add comments for documentation
COMMENT ON COLUMN recipes.servings IS 'Number of servings the recipe makes';
COMMENT ON COLUMN recipes.prep_time IS 'Preparation time (e.g., "15 minutes", "PT15M")';
COMMENT ON COLUMN recipes.cook_time IS 'Cooking time (e.g., "30 minutes", "PT30M")';
COMMENT ON COLUMN recipes.total_time IS 'Total time from start to finish';
COMMENT ON COLUMN recipes.cuisine IS 'Cuisine type (e.g., "Italian", "Mexican")';
COMMENT ON COLUMN recipes.meal_type IS 'Meal type (e.g., "breakfast", "lunch", "dinner", "dessert")';
COMMENT ON COLUMN recipes.calories IS 'Calories per serving';
COMMENT ON COLUMN recipes.protein_grams IS 'Protein in grams per serving';
COMMENT ON COLUMN recipes.fat_grams IS 'Fat in grams per serving';
COMMENT ON COLUMN recipes.carbs_grams IS 'Carbohydrates in grams per serving';

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'recipes' 
  AND column_name IN (
    'servings', 
    'prep_time', 
    'cook_time', 
    'total_time', 
    'cuisine', 
    'meal_type',
    'calories',
    'protein_grams',
    'fat_grams',
    'carbs_grams'
  )
ORDER BY column_name;

