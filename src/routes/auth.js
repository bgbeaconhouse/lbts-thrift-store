// src/routes/auth.js
// Authentication routes (login, logout, profile)

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
// Login with username and password
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const db = req.app.locals.db;

    // Find user by username
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        furniture_alerts: user.furniture_alerts,
        clothing_alerts: user.clothing_alerts,
        bricabrac_alerts: user.bricabrac_alerts
      },
      process.env.JWT_SECRET
      
    );

    // Return token and user info
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        furniture_alerts: user.furniture_alerts,
        clothing_alerts: user.clothing_alerts,
        bricabrac_alerts: user.bricabrac_alerts
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/profile
// Get current user's profile (requires authentication)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;

    const result = await db.query(
      'SELECT id, username, role, email, furniture_alerts, clothing_alerts, bricabrac_alerts FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// POST /api/auth/logout
// Logout (client-side should delete token, this is just for logging)
router.post('/logout', authenticateToken, (req, res) => {
  // In a JWT system, logout is handled client-side by deleting the token
  // This endpoint exists for logging purposes
  console.log(`User ${req.user.username} logged out`);
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;