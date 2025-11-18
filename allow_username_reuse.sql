-- Migration: Allow username reuse for deleted users
-- This removes the UNIQUE constraint on username and replaces it with a partial unique index
-- that only enforces uniqueness for non-deleted users

-- Step 1: Drop the existing UNIQUE constraint on username
ALTER TABLE users DROP CONSTRAINT users_username_key;

-- Step 2: Drop the existing index (if it exists) since we'll recreate it as unique
DROP INDEX IF EXISTS idx_users_username;

-- Step 3: Create a UNIQUE partial index that only applies to non-deleted users
-- This allows deleted usernames to be reused
CREATE UNIQUE INDEX idx_users_username_active ON users(username) WHERE deleted_at IS NULL;

-- Verification query (optional - run after migration to test)
-- This should show that only active users have unique usernames enforced:
-- SELECT username, deleted_at FROM users ORDER BY username, deleted_at;