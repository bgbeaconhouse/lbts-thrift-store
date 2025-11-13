// src/routes/discount-items.js
// API routes for 75% Off Section

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
const baseUploadDir = process.env.UPLOAD_DIR || 'uploads';
const uploadDir = path.isAbsolute(baseUploadDir) 
  ? path.join(baseUploadDir, 'discount')
  : path.join(__dirname, '../..', baseUploadDir, 'discount');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-randomstring.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'discount-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// All routes require authentication
router.use(authenticateToken);

// GET /api/discount-items - Get all discount items
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        id, picture_url, price, notes, date_added,
        created_by, created_at,
        CURRENT_DATE - date_added as days_in_discount
      FROM discount_items 
      WHERE deleted_at IS NULL 
      ORDER BY date_added DESC`
    );

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Get discount items error:', error);
    res.status(500).json({ error: 'Failed to get discount items' });
  }
});

// GET /api/discount-items/:id - Get single discount item
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        id, picture_url, price, notes, date_added,
        created_by, created_at,
        CURRENT_DATE - date_added as days_in_discount
      FROM discount_items 
      WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Get discount item error:', error);
    res.status(500).json({ error: 'Failed to get discount item' });
  }
});

// POST /api/discount-items - Create new discount item
router.post('/', upload.single('picture'), async (req, res) => {
  const { price, notes } = req.body;

  // Validation
  if (!price) {
    return res.status(400).json({ error: 'Price is required' });
  }

  try {
    const db = req.app.locals.db;
    
    // Get picture URL if uploaded
    const pictureUrl = req.file ? `/uploads/discount/${req.file.filename}` : null;

    const result = await db.query(
      `INSERT INTO discount_items (picture_url, price, notes, date_added, created_by)
       VALUES ($1, $2, $3, CURRENT_DATE, $4)
       RETURNING id, picture_url, price, notes, date_added, created_by, created_at`,
      [pictureUrl, price, notes || null, req.user.id]
    );

    res.status(201).json({ 
      message: 'Discount item created successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Create discount item error:', error);
    
    // Delete uploaded file if database insert failed
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    res.status(500).json({ error: 'Failed to create discount item' });
  }
});

// PUT /api/discount-items/:id - Update discount item
router.put('/:id', upload.single('picture'), async (req, res) => {
  const { id } = req.params;
  const { price, notes } = req.body;

  // Validation
  if (!price) {
    return res.status(400).json({ error: 'Price is required' });
  }

  try {
    const db = req.app.locals.db;

    // Get existing item to check if picture needs to be deleted
    const existingResult = await db.query(
      'SELECT picture_url FROM discount_items WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const oldPictureUrl = existingResult.rows[0].picture_url;

    // Determine picture URL
    let pictureUrl = oldPictureUrl;
    
    if (req.file) {
      // New picture uploaded
      pictureUrl = `/uploads/discount/${req.file.filename}`;
      
      // Delete old picture if it exists
      if (oldPictureUrl) {
        const oldPicturePath = path.join(__dirname, '../..', oldPictureUrl);
        fs.unlink(oldPicturePath, (err) => {
          if (err) console.error('Error deleting old picture:', err);
        });
      }
    }

    // Update item
    const result = await db.query(
      `UPDATE discount_items 
       SET picture_url = $1, price = $2, notes = $3
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, picture_url, price, notes, date_added, created_by, created_at`,
      [pictureUrl, price, notes || null, id]
    );

    res.json({ 
      message: 'Discount item updated successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Update discount item error:', error);
    
    // Delete uploaded file if database update failed
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    res.status(500).json({ error: 'Failed to update discount item' });
  }
});

// DELETE /api/discount-items/:id - Soft delete discount item
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE discount_items 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Discount item deleted successfully' });
  } catch (error) {
    console.error('Delete discount item error:', error);
    res.status(500).json({ error: 'Failed to delete discount item' });
  }
});

module.exports = router;