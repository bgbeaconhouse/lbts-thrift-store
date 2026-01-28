// src/routes/vouchers.js
// API routes for Voucher Tracking

const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// CONTACT ROUTES
// ============================================================================

// GET /api/vouchers/contacts - Get all contacts with voucher counts
router.get('/contacts', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        c.id, c.name, c.referral_agency, c.case_manager_name, 
        c.case_manager_phone, c.created_at, c.updated_at,
        COALESCE(
          (SELECT COUNT(*) 
           FROM voucher_usage v 
           WHERE v.contact_id = c.id AND v.deleted_at IS NULL), 
          0
        ) as voucher_count
      FROM voucher_contacts c
      WHERE c.deleted_at IS NULL 
      ORDER BY c.name ASC`
    );

    res.json({ contacts: result.rows });
  } catch (error) {
    console.error('Get voucher contacts error:', error);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
});

// GET /api/vouchers/contacts/:id - Get single contact with usage history
router.get('/contacts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    
    // Get contact info
    const contactResult = await db.query(
      `SELECT 
        c.id, c.name, c.referral_agency, c.case_manager_name, 
        c.case_manager_phone, c.created_at, c.updated_at,
        COALESCE(
          (SELECT COUNT(*) 
           FROM voucher_usage v 
           WHERE v.contact_id = c.id AND v.deleted_at IS NULL), 
          0
        ) as voucher_count
      FROM voucher_contacts c
      WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );

    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Get usage history
    const usageResult = await db.query(
      `SELECT 
        v.id, v.contact_id, v.date_used, v.created_at,
        u.username as created_by_username
      FROM voucher_usage v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE v.contact_id = $1 AND v.deleted_at IS NULL
      ORDER BY v.date_used DESC`,
      [id]
    );

    res.json({
      contact: contactResult.rows[0],
      usage: usageResult.rows
    });
  } catch (error) {
    console.error('Get contact details error:', error);
    res.status(500).json({ error: 'Failed to get contact details' });
  }
});

// POST /api/vouchers/contacts - Create new contact
router.post('/contacts', async (req, res) => {
  const { name, referral_agency, case_manager_name, case_manager_phone } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `INSERT INTO voucher_contacts (name, referral_agency, case_manager_name, case_manager_phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, referral_agency, case_manager_name, case_manager_phone, created_at`,
      [name.trim(), referral_agency || null, case_manager_name || null, case_manager_phone || null]
    );

    res.status(201).json({
      message: 'Contact added successfully',
      contact: result.rows[0]
    });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PUT /api/vouchers/contacts/:id - Update contact
router.put('/contacts/:id', async (req, res) => {
  const { id } = req.params;
  const { name, referral_agency, case_manager_name, case_manager_phone } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE voucher_contacts 
       SET name = $1, referral_agency = $2, case_manager_name = $3, 
           case_manager_phone = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING id, name, referral_agency, case_manager_name, case_manager_phone, updated_at`,
      [name.trim(), referral_agency || null, case_manager_name || null, 
       case_manager_phone || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({
      message: 'Contact updated successfully',
      contact: result.rows[0]
    });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/vouchers/contacts/:id - Soft delete contact
router.delete('/contacts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      'UPDATE voucher_contacts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// ============================================================================
// VOUCHER USAGE ROUTES
// ============================================================================

// POST /api/vouchers/usage - Add voucher usage
router.post('/usage', async (req, res) => {
  const { contact_id, date_used } = req.body;

  if (!contact_id) {
    return res.status(400).json({ error: 'Contact ID is required' });
  }

  if (!date_used) {
    return res.status(400).json({ error: 'Date used is required' });
  }

  try {
    const db = req.app.locals.db;

    // Verify contact exists
    const contactCheck = await db.query(
      'SELECT id FROM voucher_contacts WHERE id = $1 AND deleted_at IS NULL',
      [contact_id]
    );

    if (contactCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Add voucher usage
    const result = await db.query(
      `INSERT INTO voucher_usage (contact_id, date_used, created_by)
       VALUES ($1, $2::date, $3)
       RETURNING id, contact_id, date_used, created_at`,
      [contact_id, date_used, req.user.id]
    );

    res.status(201).json({
      message: 'Voucher usage added successfully',
      usage: result.rows[0]
    });
  } catch (error) {
    console.error('Add voucher usage error:', error);
    res.status(500).json({ error: 'Failed to add voucher usage' });
  }
});

// DELETE /api/vouchers/usage/:id - Soft delete voucher usage
router.delete('/usage/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      'UPDATE voucher_usage SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voucher usage not found' });
    }

    res.json({ message: 'Voucher usage deleted successfully' });
  } catch (error) {
    console.error('Delete voucher usage error:', error);
    res.status(500).json({ error: 'Failed to delete voucher usage' });
  }
});

module.exports = router;