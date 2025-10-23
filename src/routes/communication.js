// src/routes/communication.js
// API routes for Communication Log (Manager+ only)

const express = require('express');
const { authenticateToken, requireManagerOrAbove } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and Manager+ role
router.use(authenticateToken);
router.use(requireManagerOrAbove);

// GET /api/communication/unread-count - Get unread message count for current user
router.get('/unread-count', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT COUNT(*) as unread_count
       FROM communication_log c
       WHERE c.deleted_at IS NULL
         AND c.user_id != $1
         AND NOT EXISTS (
           SELECT 1 FROM communication_log_reads clr
           WHERE clr.message_id = c.id AND clr.user_id = $1
         )`,
      [req.user.id]
    );

    res.json({ unread_count: parseInt(result.rows[0].unread_count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// POST /api/communication/mark-all-read - Mark all messages as read for current user
router.post('/mark-all-read', async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Get all unread message IDs for this user
    const unreadMessages = await db.query(
      `SELECT c.id
       FROM communication_log c
       WHERE c.deleted_at IS NULL
         AND c.user_id != $1
         AND NOT EXISTS (
           SELECT 1 FROM communication_log_reads clr
           WHERE clr.message_id = c.id AND clr.user_id = $1
         )`,
      [req.user.id]
    );

    // Insert read records for all unread messages
    for (const msg of unreadMessages.rows) {
      await db.query(
        `INSERT INTO communication_log_reads (message_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [msg.id, req.user.id]
      );
    }

    res.json({ success: true, marked_read: unreadMessages.rows.length });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// GET /api/communication - Get all communication log entries
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        c.id, c.user_id, c.note, c.category, c.pinned, c.created_at,
        u.username, u.role
      FROM communication_log c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.deleted_at IS NULL 
      ORDER BY c.pinned DESC, c.created_at DESC`
    );

    res.json({ entries: result.rows });
  } catch (error) {
    console.error('Get communication log error:', error);
    res.status(500).json({ error: 'Failed to get communication log' });
  }
});

// GET /api/communication/:id - Get single entry
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        c.id, c.user_id, c.note, c.category, c.pinned, c.created_at,
        u.username, u.role
      FROM communication_log c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ entry: result.rows[0] });
  } catch (error) {
    console.error('Get communication entry error:', error);
    res.status(500).json({ error: 'Failed to get entry' });
  }
});

// POST /api/communication - Create new entry
router.post('/', async (req, res) => {
  const { note, category, pinned } = req.body;

  // Validation
  if (!note) {
    return res.status(400).json({ error: 'Note is required' });
  }

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `INSERT INTO communication_log (user_id, note, category, pinned)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, note, category, pinned, created_at`,
      [req.user.id, note, category || 'General', pinned || false]
    );

    // Get user info for response
    const entryWithUser = await db.query(
      `SELECT 
        c.id, c.user_id, c.note, c.category, c.pinned, c.created_at,
        u.username, u.role
      FROM communication_log c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({ 
      message: 'Entry created successfully',
      entry: entryWithUser.rows[0]
    });
  } catch (error) {
    console.error('Create communication entry error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// PUT /api/communication/:id - Update entry
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { note, category, pinned } = req.body;

  // Validation
  if (!note) {
    return res.status(400).json({ error: 'Note is required' });
  }

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE communication_log 
       SET note = $1, category = $2, pinned = $3
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id`,
      [note, category || 'General', pinned || false, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Get updated entry with user info
    const entryWithUser = await db.query(
      `SELECT 
        c.id, c.user_id, c.note, c.category, c.pinned, c.created_at,
        u.username, u.role
      FROM communication_log c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = $1`,
      [id]
    );

    res.json({ 
      message: 'Entry updated successfully',
      entry: entryWithUser.rows[0]
    });
  } catch (error) {
    console.error('Update communication entry error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// PATCH /api/communication/:id/pin - Toggle pin status
router.patch('/:id/pin', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE communication_log 
       SET pinned = NOT pinned
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, pinned`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ 
      message: result.rows[0].pinned ? 'Entry pinned' : 'Entry unpinned',
      pinned: result.rows[0].pinned
    });
  } catch (error) {
    console.error('Toggle pin error:', error);
    res.status(500).json({ error: 'Failed to toggle pin' });
  }
});

// DELETE /api/communication/:id - Soft delete entry
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE communication_log 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete communication entry error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

module.exports = router;