-- Migration: Change discount_items to support multiple images
-- This converts the single picture_url field to picture_urls array

-- First, create the new array column
ALTER TABLE discount_items 
ADD COLUMN IF NOT EXISTS picture_urls TEXT[];

-- Migrate existing data: copy single picture_url into array format
UPDATE discount_items 
SET picture_urls = ARRAY[picture_url]
WHERE picture_url IS NOT NULL AND picture_urls IS NULL;

-- Drop the old single picture column
ALTER TABLE discount_items 
DROP COLUMN IF EXISTS picture_url;

-- Add comment
COMMENT ON COLUMN discount_items.picture_urls IS 'Array of image URLs for the furniture item';