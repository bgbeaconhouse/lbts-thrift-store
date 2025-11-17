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

// GET /api/discount-items - Get all discount items with approval info and submitter names
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        di.id, di.picture_urls, di.price, di.notes, di.date_added,
        di.created_by, di.created_at,
        di.approval_status, di.approval_note, di.approved_by, di.approved_at,
        CURRENT_DATE - di.date_added as days_in_discount,
        u_created.username as created_by_username,
        u_approved.username as approved_by_username
      FROM discount_items di
      LEFT JOIN users u_created ON di.created_by = u_created.id
      LEFT JOIN users u_approved ON di.approved_by = u_approved.id
      WHERE di.deleted_at IS NULL 
      ORDER BY 
        CASE WHEN di.approval_status = 'pending' THEN 0 ELSE 1 END,
        di.date_added DESC`
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
        di.id, di.picture_urls, di.price, di.notes, di.date_added,
        di.created_by, di.created_at,
        di.approval_status, di.approval_note, di.approved_by, di.approved_at,
        CURRENT_DATE - di.date_added as days_in_discount,
        u_created.username as created_by_username,
        u_approved.username as approved_by_username
      FROM discount_items di
      LEFT JOIN users u_created ON di.created_by = u_created.id
      LEFT JOIN users u_approved ON di.approved_by = u_approved.id
      WHERE di.id = $1 AND di.deleted_at IS NULL`,
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

// POST /api/discount-items - Create new discount item (starts as pending)
router.post('/', upload.array('pictures', 10), async (req, res) => {
  const { price, notes } = req.body;

  // Validation
  if (!price) {
    return res.status(400).json({ error: 'Price is required' });
  }

  try {
    const db = req.app.locals.db;
    
    // Get picture URLs if uploaded (multiple files)
    const pictureUrls = req.files && req.files.length > 0
      ? req.files.map(file => `/uploads/discount/${file.filename}`)
      : [];

    const result = await db.query(
      `INSERT INTO discount_items (picture_urls, price, notes, date_added, created_by, approval_status)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, 'pending')
       RETURNING id, picture_urls, price, notes, date_added, created_by, created_at, approval_status`,
      [pictureUrls, price, notes || null, req.user.id]
    );

    res.status(201).json({ 
      message: 'Furniture approval request created successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Create discount item error:', error);
    
    // Delete uploaded files if database insert failed
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    
    res.status(500).json({ error: 'Failed to create furniture approval request' });
  }
});

// PUT /api/discount-items/:id - Update discount item (only if pending)
router.put('/:id', upload.array('pictures', 10), async (req, res) => {
  const { id } = req.params;
  const { price, notes } = req.body;

  // Validation
  if (!price) {
    return res.status(400).json({ error: 'Price is required' });
  }

  try {
    const db = req.app.locals.db;

    // Get existing item to check status and pictures
    const existingResult = await db.query(
      'SELECT picture_urls, approval_status FROM discount_items WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const existingItem = existingResult.rows[0];

    // Check if item is approved (locked from editing)
    if (existingItem.approval_status === 'approved') {
      return res.status(403).json({ error: 'Cannot edit approved items' });
    }

    const oldPictureUrls = existingItem.picture_urls || [];

    // Determine picture URLs
    let pictureUrls = oldPictureUrls;
    
    if (req.files && req.files.length > 0) {
      // New pictures uploaded - replace all old ones
      pictureUrls = req.files.map(file => `/uploads/discount/${file.filename}`);
      
      // Delete old pictures
      oldPictureUrls.forEach(url => {
        const oldPicturePath = path.join(__dirname, '../..', url);
        fs.unlink(oldPicturePath, (err) => {
          if (err) console.error('Error deleting old picture:', err);
        });
      });
    }

    // Update item
    const result = await db.query(
      `UPDATE discount_items 
       SET picture_urls = $1, price = $2, notes = $3
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, picture_urls, price, notes, date_added, created_by, created_at, approval_status`,
      [pictureUrls, price, notes || null, id]
    );

    res.json({ 
      message: 'Item updated successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Update discount item error:', error);
    
    // Delete uploaded files if database update failed
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    
    res.status(500).json({ error: 'Failed to update item' });
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

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete discount item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// POST /api/discount-items/:id/approve - Approve a furniture item (Admin only)
router.post('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approval_note } = req.body;

  // Check if user is admin
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only admins can approve items' });
  }

  try {
    const db = req.app.locals.db;

    // Check if item exists and is pending
    const checkResult = await db.query(
      'SELECT id, approval_status FROM discount_items WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (checkResult.rows[0].approval_status === 'approved') {
      return res.status(400).json({ error: 'Item is already approved' });
    }

    // Approve the item
    const result = await db.query(
      `UPDATE discount_items 
       SET approval_status = 'approved',
           approval_note = $1,
           approved_by = $2,
           approved_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id, picture_urls, price, notes, date_added, created_by, created_at,
                 approval_status, approval_note, approved_by, approved_at`,
      [approval_note || null, req.user.id, id]
    );

    res.json({ 
      message: 'Item approved successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Approve item error:', error);
    res.status(500).json({ error: 'Failed to approve item' });
  }
});

module.exports = router;