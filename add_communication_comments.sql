-- Add comments functionality to communication_log
-- Date: December 26, 2024

-- Step 1: Create communication_comments table
CREATE TABLE IF NOT EXISTS communication_comments (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES communication_log(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

-- Step 2: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_communication_comments_note_id ON communication_comments(note_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communication_comments_user_id ON communication_comments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communication_comments_created_at ON communication_comments(created_at) WHERE deleted_at IS NULL;

-- Verify changes
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'communication_comments';

-- Show structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'communication_comments' 
ORDER BY ordinal_position;