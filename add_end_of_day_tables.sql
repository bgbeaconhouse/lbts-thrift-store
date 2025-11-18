-- Migration: Add End of Day tables
-- Date: 2025-11-18
-- Access Control: Checklist visible to ALL STAFF, Report visible to MANAGER/ADMIN only

-- Table for daily reports (cash count, donation amount) - MANAGER/ADMIN ONLY
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE,
    cash_count DECIMAL(10, 2),
    donation_amount DECIMAL(10, 2),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for daily report images (multiple images per report) - MANAGER/ADMIN ONLY
CREATE TABLE IF NOT EXISTS daily_report_images (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES daily_reports(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for checklist template (master list of duties) - ALL STAFF ACCESS
CREATE TABLE IF NOT EXISTS checklist_templates (
    id SERIAL PRIMARY KEY,
    item_text TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for daily checklist items (completion tracking) - ALL STAFF ACCESS
CREATE TABLE IF NOT EXISTS daily_checklist_items (
    id SERIAL PRIMARY KEY,
    checklist_date DATE NOT NULL,
    template_id INTEGER REFERENCES checklist_templates(id),
    is_completed BOOLEAN DEFAULT false,
    completed_by INTEGER REFERENCES users(id),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(checklist_date, template_id)
);

-- Insert the 21 checklist items from BHTS Long Beach Closing Duties
INSERT INTO checklist_templates (item_text, display_order) VALUES
('Two guys sweep and mop the front of the store', 1),
('Empty all trash cans in the store', 2),
('Clean the break room and throw away the trash', 3),
('Clean the restrooms', 4),
('Check trash bag supply for next shift', 5),
('Organize racks and bric-a-brac section quadrant 1', 6),
('Organize racks and bric-a-brac section quadrant 2', 7),
('Organize racks and bric-a-brac section quadrant 3', 8),
('Organize racks and bri-a-brac section quadrant 4', 9),
('Take hangers back to the sorting area', 10),
('Make sure there are enough retail bags in the lanes for the next shift', 11),
('Make sure the sign is turned on', 12),
('Make sure the back gate is closed and secured', 13),
('Make sure sure the dumpster area is locked', 14),
('Organize DVD, CD, VHS, and Record area', 15),
('Sweep and organize the smoking area', 16),
('Organize the recycled furniture area to look presentable', 17),
('MAKE SURE THE A/C IS TURNED OFF IN BOTH LOCATIONS', 18),
('MAKE SURE ALL EQUIPMENT IS ACCOUNTED FOR (RAG-OUT GUNS, KEYS, ETC)', 19),
('CHECK PU/DEL LOGS TO MAKE SURE ALL ITEMS ARE ACCOUNTED FOR', 20),
('CROSS OUT ALL PU/DEL THAT HAVE BEEN COMPLETED', 21);

-- Create indexes for better performance
CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX idx_daily_report_images_report ON daily_report_images(report_id);
CREATE INDEX idx_daily_checklist_date ON daily_checklist_items(checklist_date);
CREATE INDEX idx_checklist_template_order ON checklist_templates(display_order);

-- Add comments for documentation
COMMENT ON TABLE daily_reports IS 'Stores daily cash count and donation amounts - MANAGER/ADMIN ACCESS ONLY';
COMMENT ON TABLE daily_report_images IS 'Stores multiple images for daily reports - MANAGER/ADMIN ACCESS ONLY';
COMMENT ON TABLE checklist_templates IS 'Master list of end-of-day closing duties - ALL STAFF ACCESS';
COMMENT ON TABLE daily_checklist_items IS 'Daily completion tracking for checklist items - ALL STAFF ACCESS';