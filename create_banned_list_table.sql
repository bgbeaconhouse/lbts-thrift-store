-- Create banned_list table
CREATE TABLE IF NOT EXISTS banned_list (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  picture_url TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_banned_list_deleted_at ON banned_list(deleted_at);

-- Create index for name searches
CREATE INDEX IF NOT EXISTS idx_banned_list_name ON banned_list(name);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_banned_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_banned_list_updated_at
  BEFORE UPDATE ON banned_list
  FOR EACH ROW
  EXECUTE FUNCTION update_banned_list_updated_at();