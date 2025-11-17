-- Add picture upload functionality to communication_log
-- Date: November 17, 2025

-- Step 1: Add picture_urls column to communication_log table
ALTER TABLE communication_log 
ADD COLUMN picture_urls TEXT[];

-- Step 2: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_communication_log_picture_urls ON communication_log USING GIN (picture_urls) WHERE deleted_at IS NULL AND picture_urls IS NOT NULL;

-- Verify changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'communication_log' 
AND column_name = 'picture_urls';

-- Show sample of updated table structure
SELECT 
  id, 
  user_id, 
  note, 
  category, 
  pinned, 
  is_urgent,
  picture_urls,
  created_at
FROM communication_log 
LIMIT 1;