-- Create voucher_contacts table
CREATE TABLE IF NOT EXISTS voucher_contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  referral_agency VARCHAR(255),
  case_manager_name VARCHAR(255),
  case_manager_phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Create voucher_usage table
CREATE TABLE IF NOT EXISTS voucher_usage (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES voucher_contacts(id) ON DELETE CASCADE,
  date_used DATE NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_voucher_contacts_deleted_at ON voucher_contacts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_voucher_contacts_name ON voucher_contacts(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_voucher_usage_contact_id ON voucher_usage(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_voucher_usage_date_used ON voucher_usage(date_used) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_voucher_usage_deleted_at ON voucher_usage(deleted_at);

-- Add trigger to update updated_at timestamp on voucher_contacts
CREATE OR REPLACE FUNCTION update_voucher_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_voucher_contacts_updated_at
  BEFORE UPDATE ON voucher_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_voucher_contacts_updated_at();