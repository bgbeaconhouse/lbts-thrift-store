-- Migration: Add total column to daily_reports
-- Date: 2025-11-18

ALTER TABLE daily_reports 
ADD COLUMN IF NOT EXISTS total DECIMAL(10, 2);

COMMENT ON COLUMN daily_reports.total IS 'Total amount for the day';