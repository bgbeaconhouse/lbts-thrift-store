// src/server.js
// Main Express server for LBTS Thrift Store Management System

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// Import routes (we'll create these next)
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const discountItemsRoutes = require('./routes/discount-items');
const communicationRoutes = require('./routes/communication');
const exclusiveItemsRoutes = require('./routes/exclusive-items');
const customerFormsRoutes = require('./routes/customer-forms');
const sendEmailsRoutes = require('./routes/send-emails');
const inventoryLogRoutes = require('./routes/inventory-log');
const viewFormsRoutes = require('./routes/view-forms');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// Make pool available to routes
app.locals.db = pool;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/discount-items', discountItemsRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/exclusive-items', exclusiveItemsRoutes);
app.use('/api/customer-forms', customerFormsRoutes);
app.use('/api/send-emails', sendEmailsRoutes);
app.use('/api/inventory-log', inventoryLogRoutes);
app.use('/api/view-forms', viewFormsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'LBTS API is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <h1>LBTS Thrift Store Management System</h1>
    <p>Server is running!</p>
    <p><a href="/api/health">Check API Health</a></p>
  `);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LBTS Server running on http://localhost:${PORT}`);
  console.log(`📱 Access from phone: http://[your-laptop-ip]:${PORT}`);
});

module.exports = app;