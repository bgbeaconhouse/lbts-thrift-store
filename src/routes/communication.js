// src/routes/communication.js
// API routes for Communication Log (Manager+ only)
// UPDATED: Added urgent notes functionality with SSE broadcasting

const express = require('express');
const { authenticateToken, requireManagerOrAbove, requireRole } = require('../middleware/auth');

const router = express.Router();

// Store SSE clients for broadcasting urgent notes
let sseClients = [];

// All routes require authentication
router.use(authenticateToken);

// SSE endpoint - streams urgent note broadcasts to all connected clients
// No role restriction - all authenticated users should receive urgent alerts
router.get('/urgent-stream', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Add this client to the list
  const clientId = Date.now();
  const newClient = {
    id: clientId,
    userId: req.user.id,
    response: res
  };
  
  sseClients.push(newClient);
  console.log(`SSE Client connected: ${clientId}, User: ${req.user.username}`);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Remove client when connection closes
  req.on('close', () => {
    console.log(`SSE Client disconnected: ${clientId}`);
    sseClients = sseClients.filter(client => client.id !== clientId);
  });
});

// GET /api/communication/urgent/undismissed - Get all undismissed urgent notes for current user
router.get('/urgent/undismissed', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        c.id, c.user_id, c.note, c.category, c.pinned, c.created_at, c.is_urgent,
        u.username, u.role
      FROM communication_log c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.deleted_at IS NULL 
        AND c.is_urgent = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM urgent_note_dismissals d
          WHERE d.note_id = c.id AND d.user_id = $1
        )
      ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    res.json({ urgentNotes: result.rows });
  } catch (error) {
    console.error('Get undismissed urgent notes error:', error);
    res.status(500).json({ error: 'Failed to get urgent notes' });
  }
});

// POST /api/communication/urgent/:id/dismiss - Dismiss an urgent note for current user
router.post('/urgent/:id/dismiss', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    // Verify the note exists and is urgent
    const noteCheck = await db.query(
      'SELECT id, is_urgent FROM communication_log WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (!noteCheck.rows[0].is_urgent) {
      return res.status(400).json({ error: 'Note is not marked as urgent' });
    }

    // Record dismissal (ON CONFLICT prevents duplicates)
    await db.query(
      `INSERT INTO urgent_note_dismissals (note_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (note_id, user_id) DO NOTHING`,
      [id, req.user.id]
    );

    res.json({ message: 'Urgent note dismissed successfully' });
  } catch (error) {
    console.error('Dismiss urgent note error:', error);
    res.status(500).json({ error: 'Failed to dismiss urgent note' });
  }
});

// Manager+ routes below
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
        c.id, c.user_id, c.note, c.category, c.pinned, c.is_urgent, c.created_at,
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
        c.id, c.user_id, c.note, c.category, c.pinned, c.is_urgent, c.created_at,
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

router.post('/', async (req, res) => {
  const { note, category, pinned } = req.body;

  // Validation
  if (!note) {
    return res.status(400).json({ error: 'Note is required' });
  }

  // Only admins can create urgent category notes
  if (category === 'Urgent' && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only admins can create urgent notes' });
  }

  try {
    const db = req.app.locals.db;

    // Automatically set is_urgent to true if category is "Urgent"
    const is_urgent = (category === 'Urgent');

    const result = await db.query(
      `INSERT INTO communication_log (user_id, note, category, pinned, is_urgent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, note, category, pinned, is_urgent, created_at`,
      [req.user.id, note, category || 'General', pinned || false, is_urgent]
    );
    // Get user info for response
    const entryWithUser = await db.query(
      `SELECT 
        c.id, c.user_id, c.note, c.category, c.pinned, c.is_urgent, c.created_at,
        u.username, u.role
      FROM communication_log c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = $1`,
      [result.rows[0].id]
    );

    const newEntry = entryWithUser.rows[0];

    // If urgent, broadcast to all connected SSE clients
    if (is_urgent) {
      const urgentMessage = {
        type: 'urgent_note',
        note: {
          id: newEntry.id,
          note: newEntry.note,
          category: newEntry.category,
          username: newEntry.username,
          role: newEntry.role,
          created_at: newEntry.created_at
        }
      };

      console.log(`Broadcasting urgent note to ${sseClients.length} clients`);
      
      sseClients.forEach(client => {
        try {
          client.response.write(`data: ${JSON.stringify(urgentMessage)}\n\n`);
        } catch (error) {
          console.error('Error sending to SSE client:', error);
        }
      });
    }

    res.status(201).json({ 
      message: 'Entry created successfully',
      entry: newEntry
    });
  } catch (error) {
    console.error('Create communication entry error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { note, category, pinned } = req.body;

  // Validation
  if (!note) {
    return res.status(400).json({ error: 'Note is required' });
  }

  // Only admins can modify to urgent category
  if (category === 'Urgent' && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only admins can create urgent notes' });
  }

  try {
    const db = req.app.locals.db;

    // Automatically set is_urgent based on category
    const is_urgent = (category === 'Urgent');

    const result = await db.query(
      `UPDATE communication_log 
       SET note = $1, category = $2, pinned = $3, is_urgent = $4
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING id`,
      [note, category || 'General', pinned || false, is_urgent, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Get updated entry with user info
    const entryWithUser = await db.query(
      `SELECT 
        c.id, c.user_id, c.note, c.category, c.pinned, c.is_urgent, c.created_at,
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