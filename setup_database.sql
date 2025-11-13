-- LBTS Thrift Store Management System - Database Setup
-- Run this script to create all tables

-- Create database (run separately as postgres user)
-- CREATE DATABASE lbts_store;

-- Connect to the database before running the rest
-- \c lbts_store;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- Admin, Manager, Clothing Manager, Bric-a-Brac Manager, Employee
  email VARCHAR(255),
  furniture_alerts BOOLEAN DEFAULT FALSE,
  clothing_alerts BOOLEAN DEFAULT FALSE,
  bricabrac_alerts BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Exclusive Items table (Red Tag Inventory)
CREATE TABLE exclusive_items (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- Furniture, Clothing, Bric-a-Brac
  picture_url TEXT,
  date_arrived DATE NOT NULL,
  current_price DECIMAL(10,2) NOT NULL,
  week INTEGER NOT NULL, -- 1, 2, 3, 4, 5
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- 75% Off Section table
CREATE TABLE discount_items (
  id SERIAL PRIMARY KEY,
  picture_url TEXT,
  price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  date_added DATE NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Pick-Up Forms table
CREATE TABLE pickup_forms (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  items_description TEXT,
  signature_url TEXT,
  date DATE NOT NULL,
  emailed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Delivery Forms table
CREATE TABLE delivery_forms (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  items_description TEXT,
  delivery_cost DECIMAL(10,2),
  delivery_date DATE,
  signature_url TEXT,
  date DATE NOT NULL,
  emailed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Donation Forms table
CREATE TABLE donation_forms (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  donation_description TEXT,
  signature_url TEXT,
  date DATE NOT NULL,
  emailed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Waiver Forms table
CREATE TABLE waiver_forms (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  signature_url TEXT,
  manager_signature_url TEXT,
  date DATE NOT NULL,
  emailed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Pick-Up Inventory table
CREATE TABLE pickup_inventory (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  date_purchased DATE,
  date_stored DATE NOT NULL,
  picture_urls TEXT[], -- Array of image URLs
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Delivery Inventory table
CREATE TABLE delivery_inventory (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  delivery_address TEXT NOT NULL,
  date_purchased DATE,
  date_scheduled DATE NOT NULL,
  picture_urls TEXT[], -- Array of image URLs
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Communication Log table
CREATE TABLE communication_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  note TEXT NOT NULL,
  category VARCHAR(50), -- General, Urgent, Reminder, etc.
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Communication Log Reads table (tracks which users have read which messages)
CREATE TABLE communication_log_reads (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES communication_log(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_exclusive_items_category ON exclusive_items(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_exclusive_items_week ON exclusive_items(week) WHERE deleted_at IS NULL;
CREATE INDEX idx_exclusive_items_date_arrived ON exclusive_items(date_arrived) WHERE deleted_at IS NULL;
CREATE INDEX idx_discount_items_date_added ON discount_items(date_added) WHERE deleted_at IS NULL;
CREATE INDEX idx_communication_log_pinned ON communication_log(pinned) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_communication_log_reads_message ON communication_log_reads(message_id);
CREATE INDEX idx_communication_log_reads_user ON communication_log_reads(user_id);

-- Insert initial admin user
-- Password is 'admin123' - CHANGE THIS IMMEDIATELY after first login!
-- This is a bcrypt hash with cost factor 10
INSERT INTO users (username, password_hash, role, email, furniture_alerts, clothing_alerts, bricabrac_alerts)
VALUES ('admin', '$2b$10$rZ5H3P7LQ9aP4P.Yr5LmDOqKZXJ5L5vF5nQ5zQ5zQ5zQ5zQ5zQ5zQu', 'Admin', 'admin@lbts.local', TRUE, TRUE, TRUE);

-- Note: The password hash above is a placeholder. You'll need to generate a real one.
-- See the create_admin_user.js script for proper hash generation.