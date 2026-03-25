-- Add store column to ALL data tables
ALTER TABLE exclusive_items ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE discount_items ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE pickup_forms ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE delivery_forms ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE donation_forms ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE waiver_forms ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE banned_list ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE daily_reports ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE communication_log ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE sops ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE voucher_contacts ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE voucher_usage ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE daily_checklist_items ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';
ALTER TABLE checklist_templates ADD COLUMN store VARCHAR(20) NOT NULL DEFAULT 'long_beach';