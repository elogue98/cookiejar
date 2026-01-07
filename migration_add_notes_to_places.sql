-- Add notes column to places table
ALTER TABLE places 
ADD COLUMN IF NOT EXISTS notes TEXT;

