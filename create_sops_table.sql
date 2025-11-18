-- Create SOPs table
CREATE TABLE IF NOT EXISTS sops (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on title for faster searching
CREATE INDEX idx_sops_title ON sops(title);

-- Create index on created_at for sorting
CREATE INDEX idx_sops_created_at ON sops(created_at DESC);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sops_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sops_timestamp
    BEFORE UPDATE ON sops
    FOR EACH ROW
    EXECUTE FUNCTION update_sops_updated_at();