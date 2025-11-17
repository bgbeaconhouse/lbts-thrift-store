-- Migration: Add approval fields to discount_items table for Furniture Approvals system
-- This converts the 75% Off Section into a Furniture Approvals workflow

ALTER TABLE discount_items 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved')),
ADD COLUMN IF NOT EXISTS approval_note TEXT,
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Create index for faster filtering by approval status
CREATE INDEX IF NOT EXISTS idx_discount_items_approval_status ON discount_items(approval_status) WHERE deleted_at IS NULL;

-- Add comment to table
COMMENT ON TABLE discount_items IS 'Furniture Approvals - Items pending or approved for discounted pricing';
COMMENT ON COLUMN discount_items.approval_status IS 'Status: pending (awaiting approval) or approved (ready for floor)';
COMMENT ON COLUMN discount_items.approval_note IS 'Optional note added by admin during approval (visible to all staff)';
COMMENT ON COLUMN discount_items.approved_by IS 'User ID of admin who approved the item';
COMMENT ON COLUMN discount_items.approved_at IS 'Timestamp when item was approved';