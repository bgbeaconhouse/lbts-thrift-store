const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Middleware to check if user is Admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

// GET all SOPs (available to all authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(`
      SELECT 
        s.id,
        s.title,
        s.content,
        s.created_at,
        s.updated_at,
        u.username as created_by_username
      FROM sops s
      JOIN users u ON s.created_by = u.id
      ORDER BY s.title ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching SOPs:', error);
    res.status(500).json({ error: 'Failed to fetch SOPs' });
  }
});

// GET single SOP by ID (available to all authenticated users)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        s.id,
        s.title,
        s.content,
        s.created_at,
        s.updated_at,
        u.username as created_by_username
      FROM sops s
      JOIN users u ON s.created_by = u.id
      WHERE s.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SOP not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching SOP:', error);
    res.status(500).json({ error: 'Failed to fetch SOP' });
  }
});

// POST create new SOP (Admin only)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { title, content } = req.body;

    // Validation
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (title.trim().length === 0 || content.trim().length === 0) {
      return res.status(400).json({ error: 'Title and content cannot be empty' });
    }

    const result = await db.query(`
      INSERT INTO sops (title, content, created_by)
      VALUES ($1, $2, $3)
      RETURNING id, title, content, created_by, created_at, updated_at
    `, [title.trim(), content.trim(), req.user.id]);

    res.status(201).json({
      message: 'SOP created successfully',
      sop: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating SOP:', error);
    res.status(500).json({ error: 'Failed to create SOP' });
  }
});

// PUT update existing SOP (Admin only)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { title, content } = req.body;

    // Validation
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (title.trim().length === 0 || content.trim().length === 0) {
      return res.status(400).json({ error: 'Title and content cannot be empty' });
    }

    // Check if SOP exists
    const checkResult = await db.query('SELECT id FROM sops WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'SOP not found' });
    }

    // Update the SOP
    const result = await db.query(`
      UPDATE sops 
      SET title = $1, content = $2
      WHERE id = $3
      RETURNING id, title, content, created_by, created_at, updated_at
    `, [title.trim(), content.trim(), id]);

    res.json({
      message: 'SOP updated successfully',
      sop: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating SOP:', error);
    res.status(500).json({ error: 'Failed to update SOP' });
  }
});

// DELETE SOP (Admin only)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    // Check if SOP exists
    const checkResult = await db.query('SELECT id FROM sops WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'SOP not found' });
    }

    // Delete the SOP
    await db.query('DELETE FROM sops WHERE id = $1', [id]);

    res.json({ message: 'SOP deleted successfully' });
  } catch (error) {
    console.error('Error deleting SOP:', error);
    res.status(500).json({ error: 'Failed to delete SOP' });
  }
});

module.exports = router;