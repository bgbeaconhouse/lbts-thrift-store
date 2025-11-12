-- Add email_queue table for queued email system
-- Run this on your PostgreSQL database after pulling from git

CREATE TABLE email_queue (
  id SERIAL PRIMARY KEY,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  form_type VARCHAR(50), -- pickup, delivery, donation, waiver, general
  form_id INTEGER, -- Reference to the form that generated this email
  error_message TEXT, -- Store error details if sending fails
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,
  attempts INTEGER DEFAULT 0 -- Track how many times we've tried to send
);

-- Create index for faster queries on pending emails
CREATE INDEX idx_email_queue_status ON email_queue(status) WHERE status = 'pending';
CREATE INDEX idx_email_queue_created ON email_queue(created_at);