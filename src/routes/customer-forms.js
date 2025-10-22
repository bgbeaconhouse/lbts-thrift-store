// src/routes/customer-forms.js
// API routes for Customer Forms (Pick-up, Delivery, Donation)

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for signature image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/signatures');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'signature-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit for signatures
  }
});

// All routes require authentication
router.use(authenticateToken);

// ==================== PICKUP FORMS ====================

// GET /api/customer-forms/pickup - Get all pickup forms
router.get('/pickup', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT id, customer_name, phone, email, items_description, 
              signature_url, date, emailed, created_at
       FROM pickup_forms 
       WHERE deleted_at IS NULL 
       ORDER BY created_at DESC`
    );

    res.json({ forms: result.rows });
  } catch (error) {
    console.error('Get pickup forms error:', error);
    res.status(500).json({ error: 'Failed to get pickup forms' });
  }
});

// POST /api/customer-forms/pickup - Create pickup form
router.post('/pickup', upload.single('signature'), async (req, res) => {
  const { customer_name, phone, email, items_description } = req.body;

  // Validation
  if (!customer_name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone are required' });
  }

  try {
    const db = req.app.locals.db;
    
    const signatureUrl = req.file ? `/uploads/signatures/${req.file.filename}` : null;

    const result = await db.query(
      `INSERT INTO pickup_forms (customer_name, phone, email, items_description, signature_url, date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       RETURNING id, customer_name, phone, email, items_description, signature_url, date, emailed, created_at`,
      [customer_name, phone, email || null, items_description || null, signatureUrl]
    );

    res.status(201).json({ 
      message: 'Pickup form created successfully',
      form: result.rows[0] 
    });
  } catch (error) {
    console.error('Create pickup form error:', error);
    
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    res.status(500).json({ error: 'Failed to create pickup form' });
  }
});

// DELETE /api/customer-forms/pickup/:id - Soft delete pickup form
router.delete('/pickup/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE pickup_forms 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.json({ message: 'Pickup form deleted successfully' });
  } catch (error) {
    console.error('Delete pickup form error:', error);
    res.status(500).json({ error: 'Failed to delete pickup form' });
  }
});

// ==================== DELIVERY FORMS ====================

// GET /api/customer-forms/delivery - Get all delivery forms
router.get('/delivery', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT id, customer_name, phone, email, items_description, 
              signature_url, date, emailed, created_at
       FROM delivery_forms 
       WHERE deleted_at IS NULL 
       ORDER BY created_at DESC`
    );

    res.json({ forms: result.rows });
  } catch (error) {
    console.error('Get delivery forms error:', error);
    res.status(500).json({ error: 'Failed to get delivery forms' });
  }
});

// POST /api/customer-forms/delivery - Create delivery form
router.post('/delivery', upload.single('signature'), async (req, res) => {
  const { customer_name, phone, email, items_description } = req.body;

  // Validation
  if (!customer_name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone are required' });
  }

  try {
    const db = req.app.locals.db;
    
    const signatureUrl = req.file ? `/uploads/signatures/${req.file.filename}` : null;

    const result = await db.query(
      `INSERT INTO delivery_forms (customer_name, phone, email, items_description, signature_url, date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       RETURNING id, customer_name, phone, email, items_description, signature_url, date, emailed, created_at`,
      [customer_name, phone, email || null, items_description || null, signatureUrl]
    );

    res.status(201).json({ 
      message: 'Delivery form created successfully',
      form: result.rows[0] 
    });
  } catch (error) {
    console.error('Create delivery form error:', error);
    
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    res.status(500).json({ error: 'Failed to create delivery form' });
  }
});

// DELETE /api/customer-forms/delivery/:id - Soft delete delivery form
router.delete('/delivery/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE delivery_forms 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.json({ message: 'Delivery form deleted successfully' });
  } catch (error) {
    console.error('Delete delivery form error:', error);
    res.status(500).json({ error: 'Failed to delete delivery form' });
  }
});

// ==================== DONATION FORMS ====================

// GET /api/customer-forms/donation - Get all donation forms
router.get('/donation', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT id, customer_name, phone, email, donation_description, 
              signature_url, date, emailed, created_at
       FROM donation_forms 
       WHERE deleted_at IS NULL 
       ORDER BY created_at DESC`
    );

    res.json({ forms: result.rows });
  } catch (error) {
    console.error('Get donation forms error:', error);
    res.status(500).json({ error: 'Failed to get donation forms' });
  }
});

// POST /api/customer-forms/donation - Create donation form
router.post('/donation', upload.single('signature'), async (req, res) => {
  const { customer_name, phone, email, donation_description } = req.body;

  // Validation
  if (!customer_name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone are required' });
  }

  try {
    const db = req.app.locals.db;
    
    const signatureUrl = req.file ? `/uploads/signatures/${req.file.filename}` : null;

    const result = await db.query(
      `INSERT INTO donation_forms (customer_name, phone, email, donation_description, signature_url, date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       RETURNING id, customer_name, phone, email, donation_description, signature_url, date, emailed, created_at`,
      [customer_name, phone, email || null, donation_description || null, signatureUrl]
    );

    res.status(201).json({ 
      message: 'Donation form created successfully',
      form: result.rows[0] 
    });
  } catch (error) {
    console.error('Create donation form error:', error);
    
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    res.status(500).json({ error: 'Failed to create donation form' });
  }
});

// DELETE /api/customer-forms/donation/:id - Soft delete donation form
router.delete('/donation/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE donation_forms 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.json({ message: 'Donation form deleted successfully' });
  } catch (error) {
    console.error('Delete donation form error:', error);
    res.status(500).json({ error: 'Failed to delete donation form' });
  }
});

// ==================== EMAIL QUEUE ====================

// GET /api/customer-forms/pending - Get count of pending emails (Admin only)
router.get('/pending', requireRole('Admin'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const pickup = await db.query(
      'SELECT COUNT(*) FROM pickup_forms WHERE emailed = FALSE AND deleted_at IS NULL'
    );
    const delivery = await db.query(
      'SELECT COUNT(*) FROM delivery_forms WHERE emailed = FALSE AND deleted_at IS NULL'
    );
    const donation = await db.query(
      'SELECT COUNT(*) FROM donation_forms WHERE emailed = FALSE AND deleted_at IS NULL'
    );

    const total = parseInt(pickup.rows[0].count) + 
                  parseInt(delivery.rows[0].count) + 
                  parseInt(donation.rows[0].count);

    res.json({ 
      total,
      pickup: parseInt(pickup.rows[0].count),
      delivery: parseInt(delivery.rows[0].count),
      donation: parseInt(donation.rows[0].count)
    });
  } catch (error) {
    console.error('Get pending emails error:', error);
    res.status(500).json({ error: 'Failed to get pending emails count' });
  }
});

module.exports = router;