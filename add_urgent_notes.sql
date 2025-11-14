-- Add urgent notes functionality to LBTS database
-- Date: November 13, 2025

-- Step 1: Add is_urgent column to communication_log table
ALTER TABLE communication_log 
ADD COLUMN is_urgent BOOLEAN DEFAULT FALSE;

-- Step 2: Create table to track which users have dismissed which urgent notes
CREATE TABLE IF NOT EXISTS urgent_note_dismissals (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES communication_log(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(note_id, user_id) -- Prevent duplicate dismissals
);

-- Step 3: Add index for faster lookups
CREATE INDEX idx_urgent_note_dismissals_note_id ON urgent_note_dismissals(note_id);
CREATE INDEX idx_urgent_note_dismissals_user_id ON urgent_note_dismissals(user_id);

-- Verify changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'communication_log' 
AND column_name = 'is_urgent';

SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'urgent_note_dismissals';