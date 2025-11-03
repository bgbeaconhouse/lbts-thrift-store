const express = require('express');
const router = express.Router();

// GET /api/view-forms/:type - Get all forms of a specific type
router.get('/:type', async (req, res) => {
  const { type } = req.params;
  const validTypes = ['pickup', 'delivery', 'donation', 'waiver'];

  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  try {
    const db = req.app.locals.db;
    const tableName = `${type}_forms`;

    // Different columns for different form types
    let query;
    if (type === 'waiver') {
      query = `SELECT id, customer_name, phone, email, date, emailed, created_at
               FROM ${tableName}
               WHERE deleted_at IS NULL
               ORDER BY created_at DESC`;
    } else if (type === 'donation') {
      query = `SELECT id, customer_name, phone, email, date, emailed, created_at,
                      donation_description as description
               FROM ${tableName}
               WHERE deleted_at IS NULL
               ORDER BY created_at DESC`;
    } else {
      // pickup and delivery forms
      query = `SELECT id, customer_name, phone, email, date, emailed, created_at,
                      items_description as description
               FROM ${tableName}
               WHERE deleted_at IS NULL
               ORDER BY created_at DESC`;
    }

    const result = await db.query(query);

    res.json({ forms: result.rows });
  } catch (error) {
    console.error('Get forms error:', error);
    res.status(500).json({ error: 'Failed to get forms' });
  }
});

// GET /api/view-forms/:type/:id - Get specific form with full details
router.get('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const validTypes = ['pickup', 'delivery', 'donation', 'waiver'];

  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  try {
    const db = req.app.locals.db;
    const tableName = `${type}_forms`;

    const result = await db.query(
      `SELECT * FROM ${tableName}
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.json({ form: result.rows[0] });
  } catch (error) {
    console.error('Get form details error:', error);
    res.status(500).json({ error: 'Failed to get form details' });
  }
});

module.exports = router;