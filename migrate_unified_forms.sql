-- Migration Script: Unify Customer Forms and Inventory Tables
-- This script merges pickup_forms + pickup_inventory, and delivery_forms + delivery_inventory
-- Run this script on your PostgreSQL database

-- ========================================
-- STEP 1: Add new columns to pickup_forms
-- ========================================

-- Add inventory-related columns to pickup_forms
ALTER TABLE pickup_forms 
ADD COLUMN IF NOT EXISTS picture_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS date_purchased DATE,
ADD COLUMN IF NOT EXISTS date_stored DATE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Add email tracking columns (replacing simple 'emailed' boolean)
ALTER TABLE pickup_forms 
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Update email_sent from old emailed field
UPDATE pickup_forms SET email_sent = emailed WHERE emailed = TRUE;

-- ========================================
-- STEP 2: Add new columns to delivery_forms
-- ========================================

-- Add inventory-related columns to delivery_forms
ALTER TABLE delivery_forms 
ADD COLUMN IF NOT EXISTS picture_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS date_scheduled DATE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Add delivery_address (this was only in delivery_inventory before)
ALTER TABLE delivery_forms 
ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Add email tracking columns
ALTER TABLE delivery_forms 
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Update email_sent from old emailed field
UPDATE delivery_forms SET email_sent = emailed WHERE emailed = TRUE;

-- ========================================
-- STEP 3: Update donation_forms and waiver_forms
-- ========================================

-- Add email tracking to donation_forms
ALTER TABLE donation_forms 
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_error TEXT;

UPDATE donation_forms SET email_sent = emailed WHERE emailed = TRUE;

-- Add email tracking to waiver_forms
ALTER TABLE waiver_forms 
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_error TEXT;

UPDATE waiver_forms SET email_sent = emailed WHERE emailed = TRUE;

-- ========================================
-- STEP 4: Migrate data from inventory tables
-- ========================================

-- Migrate pickup_inventory data into pickup_forms
-- This creates new entries in pickup_forms for any inventory items that don't have a corresponding form
INSERT INTO pickup_forms (
  customer_name, 
  phone, 
  email,
  items_description,
  date,
  date_purchased,
  date_stored,
  picture_urls,
  notes,
  created_by,
  created_at,
  email_sent
)
SELECT 
  pi.customer_name,
  pi.phone,
  NULL as email,  -- inventory didn't track email
  pi.notes as items_description,  -- move notes to items_description
  pi.date_stored as date,  -- use stored date as the form date
  pi.date_purchased,
  pi.date_stored,
  pi.picture_urls,
  pi.notes,
  pi.created_by,
  pi.created_at,
  FALSE as email_sent  -- these were never emailed
FROM pickup_inventory pi
WHERE pi.deleted_at IS NULL;

-- Migrate delivery_inventory data into delivery_forms
INSERT INTO delivery_forms (
  customer_name, 
  phone, 
  email,
  items_description,
  delivery_address,
  date,
  date_scheduled,
  picture_urls,
  notes,
  created_by,
  created_at,
  email_sent
)
SELECT 
  di.customer_name,
  di.phone,
  NULL as email,  -- inventory didn't track email
  di.notes as items_description,  -- move notes to items_description
  di.delivery_address,
  di.date_scheduled as date,  -- use scheduled date as the form date
  di.date_scheduled,
  di.picture_urls,
  di.notes,
  di.created_by,
  di.created_at,
  FALSE as email_sent  -- these were never emailed
FROM delivery_inventory di
WHERE di.deleted_at IS NULL;

-- ========================================
-- STEP 5: Rename old 'emailed' column (for reference)
-- ========================================

-- Rename the old emailed column to keep it for reference but not use it
ALTER TABLE pickup_forms RENAME COLUMN emailed TO emailed_legacy;
ALTER TABLE delivery_forms RENAME COLUMN emailed TO emailed_legacy;
ALTER TABLE donation_forms RENAME COLUMN emailed TO emailed_legacy;
ALTER TABLE waiver_forms RENAME COLUMN emailed TO emailed_legacy;

-- ========================================
-- STEP 6: (OPTIONAL) Archive old inventory tables
-- ========================================

-- Rename the old tables instead of dropping them (safer for rollback)
-- You can drop these later after confirming everything works

ALTER TABLE pickup_inventory RENAME TO pickup_inventory_archived;
ALTER TABLE delivery_inventory RENAME TO delivery_inventory_archived;

-- ========================================
-- STEP 7: Create indexes for performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_pickup_forms_date_stored ON pickup_forms(date_stored) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pickup_forms_email_sent ON pickup_forms(email_sent) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_forms_date_scheduled ON delivery_forms(date_scheduled) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_forms_email_sent ON delivery_forms(email_sent) WHERE deleted_at IS NULL;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Run these queries to verify the migration worked correctly:

-- Check pickup_forms structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pickup_forms' ORDER BY ordinal_position;

-- Check delivery_forms structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'delivery_forms' ORDER BY ordinal_position;

-- Count records
-- SELECT 'pickup_forms' as table_name, COUNT(*) as count FROM pickup_forms WHERE deleted_at IS NULL
-- UNION ALL
-- SELECT 'delivery_forms', COUNT(*) FROM delivery_forms WHERE deleted_at IS NULL
-- UNION ALL
-- SELECT 'donation_forms', COUNT(*) FROM donation_forms WHERE deleted_at IS NULL
-- UNION ALL
-- SELECT 'waiver_forms', COUNT(*) FROM waiver_forms WHERE deleted_at IS NULL;

-- Migration complete!
-- Next steps:
-- 1. Test the new unified form interface
-- 2. Verify all data is accessible
-- 3. After 1-2 weeks, you can drop the archived tables:
--    DROP TABLE pickup_inventory_archived;
--    DROP TABLE delivery_inventory_archived;