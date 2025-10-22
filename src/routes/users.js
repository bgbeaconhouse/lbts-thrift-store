// src/routes/users.js
// User management routes (Admin only)

const express = require('express');
const bcrypt = require('bcrypt');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require Admin role
router.use(authenticateToken);
router.use(requireRole('Admin'));

// GET /api/users - Get all users
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT id, username, role, email, 
              furniture_alerts, clothing_alerts, bricabrac_alerts, 
              created_at 
       FROM users 
       WHERE deleted_at IS NULL 
       ORDER BY created_at DESC`
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  const { username, password, role, email, furniture_alerts, clothing_alerts, bricabrac_alerts } = req.body;

  // Validation
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required' });
  }

  const validRoles = ['Admin', 'Manager', 'Clothing Manager', 'Bric-a-Brac Manager', 'Employee'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const db = req.app.locals.db;

    // Check if username already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (username, password_hash, role, email, furniture_alerts, clothing_alerts, bricabrac_alerts)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, role, email, furniture_alerts, clothing_alerts, bricabrac_alerts, created_at`,
      [username, passwordHash, role, email || null, furniture_alerts || false, clothing_alerts || false, bricabrac_alerts || false]
    );

    res.status(201).json({ 
      message: 'User created successfully',
      user: result.rows[0] 
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, role, email, furniture_alerts, clothing_alerts, bricabrac_alerts } = req.body;

  // Validation
  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  const validRoles = ['Admin', 'Manager', 'Clothing Manager', 'Bric-a-Brac Manager', 'Employee'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const db = req.app.locals.db;

    // Build update query dynamically
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (username) {
      updateFields.push(`username = $${paramCount++}`);
      values.push(username);
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
    }

    updateFields.push(`role = $${paramCount++}`);
    values.push(role);

    updateFields.push(`email = $${paramCount++}`);
    values.push(email || null);

    updateFields.push(`furniture_alerts = $${paramCount++}`);
    values.push(furniture_alerts || false);

    updateFields.push(`clothing_alerts = $${paramCount++}`);
    values.push(clothing_alerts || false);

    updateFields.push(`bricabrac_alerts = $${paramCount++}`);
    values.push(bricabrac_alerts || false);

    updateFields.push(`updated_at = NOW()`);

    values.push(id);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING id, username, role, email, furniture_alerts, clothing_alerts, bricabrac_alerts
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'User updated successfully',
      user: result.rows[0] 
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Soft delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    // Can't delete yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await db.query(
      `UPDATE users 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;