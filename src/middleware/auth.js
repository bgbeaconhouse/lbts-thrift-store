// src/middleware/auth.js
// JWT authentication middleware

const jwt = require('jsonwebtoken');

// Verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user; // Add user info to request
    next();
  });
};

// Check if user has specific role
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Check if user has Manager or Admin role (for Communication Log access)
const requireManagerOrAbove = (req, res, next) => {
  const managerRoles = ['Admin', 'Manager', 'Clothing Manager', 'Bric-a-Brac Manager'];
  
  if (!req.user || !managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireManagerOrAbove
};