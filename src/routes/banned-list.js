// src/routes/banned-list.js
// API routes for Banned List management

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for banned list image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const baseUploadDir = process.env.UPLOAD_DIR || 'uploads';
    const uploadDir = path.isAbsolute(baseUploadDir) 
      ? path.join(baseUploadDir, 'banned-list')
      : path.join(__dirname, '../..', baseUploadDir, 'banned-list');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'banned-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// All routes require authentication
router.use(authenticateToken);

// GET /api/banned-list - Get all banned list entries
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        b.id, b.name, b.picture_url, b.notes, b.created_at, b.updated_at,
        u.username as created_by_username
      FROM banned_list b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.deleted_at IS NULL 
      ORDER BY b.created_at DESC`
    );

    res.json({ entries: result.rows });
  } catch (error) {
    console.error('Get banned list error:', error);
    res.status(500).json({ error: 'Failed to get banned list' });
  }
});

// GET /api/banned-list/:id - Get single entry
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        b.id, b.name, b.picture_url, b.notes, b.created_at, b.updated_at,
        u.username as created_by_username
      FROM banned_list b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.id = $1 AND b.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ entry: result.rows[0] });
  } catch (error) {
    console.error('Get banned list entry error:', error);
    res.status(500).json({ error: 'Failed to get entry' });
  }
});

// POST /api/banned-list - Create new entry
router.post('/', upload.single('picture'), async (req, res) => {
  const { name, notes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const db = req.app.locals.db;
    
    let pictureUrl = null;
    if (req.file) {
      pictureUrl = `/uploads/banned-list/${req.file.filename}`;
    }

    const result = await db.query(
      `INSERT INTO banned_list (name, picture_url, notes, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, picture_url, notes, created_at`,
      [name.trim(), pictureUrl, notes || null, req.user.id]
    );

    res.status(201).json({
      message: 'Entry added successfully',
      entry: result.rows[0]
    });
  } catch (error) {
    console.error('Create banned list entry error:', error);
    
    // Clean up uploaded file if database insert fails
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// PUT /api/banned-list/:id - Update entry
router.put('/:id', upload.single('picture'), async (req, res) => {
  const { id } = req.params;
  const { name, notes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const db = req.app.locals.db;

    // Get existing entry to check if it exists and get old picture
    const existing = await db.query(
      'SELECT picture_url FROM banned_list WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    let pictureUrl = existing.rows[0].picture_url;

    // If new picture uploaded, delete old one and update URL
    if (req.file) {
      // Delete old picture if exists
      if (pictureUrl) {
        const baseUploadDir = process.env.UPLOAD_DIR || 'uploads';
        const uploadPath = path.isAbsolute(baseUploadDir) 
          ? baseUploadDir
          : path.join(__dirname, '../..', baseUploadDir);
        
        const oldFilename = pictureUrl.split('/').pop();
        const oldFilepath = path.join(uploadPath, 'banned-list', oldFilename);
        
        fs.unlink(oldFilepath, (err) => {
          if (err) console.error('Error deleting old picture:', err);
        });
      }

      pictureUrl = `/uploads/banned-list/${req.file.filename}`;
    }

    // Update entry
    const result = await db.query(
      `UPDATE banned_list 
       SET name = $1, picture_url = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, name, picture_url, notes, created_at, updated_at`,
      [name.trim(), pictureUrl, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({
      message: 'Entry updated successfully',
      entry: result.rows[0]
    });
  } catch (error) {
    console.error('Update banned list entry error:', error);
    
    // Clean up uploaded file if database update fails
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// DELETE /api/banned-list/:id - Soft delete entry
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    // Soft delete the entry
    const result = await db.query(
      'UPDATE banned_list SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete banned list entry error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

module.exports = router;