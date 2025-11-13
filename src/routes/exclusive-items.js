// src/routes/exclusive-items.js
// API routes for Exclusive Items (Red Tag Inventory)

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
  ? path.join(baseUploadDir, 'exclusive')
  : path.join(__dirname, '../..', baseUploadDir, 'exclusive');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'exclusive-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
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


// Helper function to auto-promote items to Week 5
async function autoPromoteToWeek5(db) {
  try {
    await db.query(
      `UPDATE exclusive_items 
       SET week = 5, updated_at = NOW()
       WHERE deleted_at IS NULL 
         AND week = 4 
         AND CURRENT_DATE - date_arrived >= 28`
    );
  } catch (error) {
    console.error('Auto-promote to Week 5 error:', error);
  }
}

// GET /api/exclusive-items - Get all exclusive items
router.get('/', async (req, res) => {
  const { category } = req.query;

  try {
    const db = req.app.locals.db;

     await autoPromoteToWeek5(db);
    
    let query = `
      SELECT 
        id, category, picture_url, date_arrived, current_price, week, notes,
        created_by, created_at, updated_at,
        CURRENT_DATE - date_arrived as days_since_arrival
      FROM exclusive_items 
      WHERE deleted_at IS NULL
    `;
    
    const params = [];
    
    if (category) {
      query += ' AND category = $1';
      params.push(category);
    }
    
    query += ' ORDER BY week ASC, date_arrived DESC';

    const result = await db.query(query, params);

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Get exclusive items error:', error);
    res.status(500).json({ error: 'Failed to get exclusive items' });
  }
});

// GET /api/exclusive-items/alerts - Get items needing price updates
router.get('/alerts', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;

 

    // Get user's alert permissions
    const userResult = await db.query(
      'SELECT furniture_alerts, clothing_alerts, bricabrac_alerts FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const permissions = userResult.rows[0];
    const categories = [];
    
    if (permissions.furniture_alerts) categories.push('Furniture');
    if (permissions.clothing_alerts) categories.push('Clothing');
    if (permissions.bricabrac_alerts) categories.push('Bric-a-Brac');

    if (categories.length === 0) {
      return res.json({ alerts: [] });
    }

 // Get items that need week updates based on days since arrival OR are in color cycle (week 5)
const result = await db.query(
  `SELECT 
    id, category, picture_url, date_arrived, current_price, week, notes,
    CURRENT_DATE - date_arrived as days_since_arrival
  FROM exclusive_items 
  WHERE deleted_at IS NULL 
    AND category = ANY($1)
    AND (
      (week = 1 AND CURRENT_DATE - date_arrived >= 7) OR
      (week = 2 AND CURRENT_DATE - date_arrived >= 14) OR
      (week = 3 AND CURRENT_DATE - date_arrived >= 21) OR
      (week = 5)
    )
  ORDER BY date_arrived ASC`,
  [categories]
);

    res.json({ alerts: result.rows });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// GET /api/exclusive-items/color-cycle - Get items ready for color cycle (Week 5+)
router.get('/color-cycle', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Get items that are week 5 (color cycle)
    const result = await db.query(
      `SELECT id, category, picture_url, date_arrived, current_price, week, notes,
              CURRENT_DATE - date_arrived as days_in_store
       FROM exclusive_items
       WHERE deleted_at IS NULL 
         AND week = 5
       ORDER BY date_arrived ASC`
    );

    res.json({ items: result.rows || [] });
  } catch (error) {
    console.error('Get color cycle items error:', error);
    res.status(500).json({ error: 'Failed to get color cycle items' });
  }
});

// GET /api/exclusive-items/:id - Get single exclusive item
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        id, category, picture_url, date_arrived, current_price, week, notes,
        created_by, created_at, updated_at,
        CURRENT_DATE - date_arrived as days_since_arrival
      FROM exclusive_items 
      WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Get exclusive item error:', error);
    res.status(500).json({ error: 'Failed to get exclusive item' });
  }
});

// POST /api/exclusive-items - Create new exclusive item
router.post('/', upload.single('picture'), async (req, res) => {
  const { category, current_price, notes } = req.body;

  // Validation
  if (!category || !current_price) {
    return res.status(400).json({ error: 'Category and price are required' });
  }

  const validCategories = ['Furniture', 'Clothing', 'Bric-a-Brac'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  try {
    const db = req.app.locals.db;
    
    const pictureUrl = req.file ? `/uploads/exclusive/${req.file.filename}` : null;

    const result = await db.query(
      `INSERT INTO exclusive_items (category, picture_url, date_arrived, current_price, week, notes, created_by)
       VALUES ($1, $2, CURRENT_DATE, $3, 1, $4, $5)
       RETURNING id, category, picture_url, date_arrived, current_price, week, notes, created_by, created_at`,
      [category, pictureUrl, current_price, notes || null, req.user.id]
    );

    res.status(201).json({ 
      message: 'Exclusive item created successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Create exclusive item error:', error);
    
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    res.status(500).json({ error: 'Failed to create exclusive item' });
  }
});

// PUT /api/exclusive-items/:id - Update exclusive item
router.put('/:id', upload.single('picture'), async (req, res) => {
  const { id } = req.params;
 let { category, current_price, week, notes } = req.body;
  // Validation
  if (!category || !current_price || !week) {
    return res.status(400).json({ error: 'Category, price, and week are required' });
  }

  const validCategories = ['Furniture', 'Clothing', 'Bric-a-Brac'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  try {
    const db = req.app.locals.db;

// Handle color-cycle selection (change to week 5, don't delete)
if (week === 'color-cycle') {
  week = 5; // Set to week 5 instead of deleting
}

if (![1, 2, 3, 4, 5].includes(parseInt(week))) {
  return res.status(400).json({ error: 'Week must be 1, 2, 3, 4, or 5' });
}

    // Get existing item
    const existingResult = await db.query(
      'SELECT picture_url FROM exclusive_items WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const oldPictureUrl = existingResult.rows[0].picture_url;

    // Determine picture URL
    let pictureUrl = oldPictureUrl;
    
    if (req.file) {
      pictureUrl = `/uploads/exclusive/${req.file.filename}`;
      
      if (oldPictureUrl) {
        const oldPicturePath = path.join(__dirname, '../..', oldPictureUrl);
        fs.unlink(oldPicturePath, (err) => {
          if (err) console.error('Error deleting old picture:', err);
        });
      }
    }

    // Update item
    const result = await db.query(
      `UPDATE exclusive_items 
       SET category = $1, picture_url = $2, current_price = $3, week = $4, notes = $5, updated_at = NOW()
       WHERE id = $6 AND deleted_at IS NULL
       RETURNING id, category, picture_url, date_arrived, current_price, week, notes, created_by, created_at, updated_at`,
      [category, pictureUrl, current_price, week, notes || null, id]
    );

    res.json({ 
      message: 'Exclusive item updated successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Update exclusive item error:', error);
    
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    res.status(500).json({ error: 'Failed to update exclusive item' });
  }
});
// PATCH /api/exclusive-items/bulk-update - Bulk update prices and weeks
router.patch('/bulk-update', async (req, res) => {
  const { items } = req.body; // Array of { id, current_price, week }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  try {
    const db = req.app.locals.db;

    // Update each item
    const promises = items.map(item => {
      return db.query(
        `UPDATE exclusive_items 
         SET current_price = $1, week = $2, updated_at = NOW()
         WHERE id = $3 AND deleted_at IS NULL`,
        [item.current_price, item.week, item.id]
      );
    });

    await Promise.all(promises);

    res.json({ 
      message: `Successfully updated ${items.length} item${items.length !== 1 ? 's' : ''}`,
      count: items.length
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update items' });
  }
});

// DELETE /api/exclusive-items/:id - Soft delete exclusive item
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE exclusive_items 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Exclusive item deleted successfully' });
  } catch (error) {
    console.error('Delete exclusive item error:', error);
    res.status(500).json({ error: 'Failed to delete exclusive item' });
  }
});



// POST /api/exclusive-items/:id/move-to-color-cycle - Confirm item moved to color cycle
router.post('/:id/move-to-color-cycle', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    // Soft delete the item
    const result = await db.query(
      `UPDATE exclusive_items 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, category`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ 
      message: 'Item successfully moved to color cycle',
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Move to color cycle error:', error);
    res.status(500).json({ error: 'Failed to move item to color cycle' });
  }
});

module.exports = router;