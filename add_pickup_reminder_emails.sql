-- Migration: Add due today and final notice email tracking to pickup_forms
-- Run date: 2026-04-09

ALTER TABLE pickup_forms
ADD COLUMN IF NOT EXISTS due_today_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS due_today_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS final_notice_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS final_notice_sent_at TIMESTAMP;