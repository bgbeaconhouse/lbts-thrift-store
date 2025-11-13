// src/routes/inventory-log.js
// API routes for Pick Up & Delivery Inventory Log

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for multiple image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine destination based on type (pickup or delivery)
    const type = req.body.type || 'pickup';
    const baseUploadDir = process.env.UPLOAD_DIR || 'uploads';
    const uploadDir = path.isAbsolute(baseUploadDir)
      ? path.join(baseUploadDir, type)
      : path.join(__dirname, '../..', baseUploadDir, type);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const type = req.body.type || 'pickup';
    cb(null, `${type}-` + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB per file
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

// ==================== PICKUP INVENTORY ====================

// GET /api/inventory-log/pickup - Get all pickup inventory
router.get('/pickup', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        id, customer_name, phone, date_purchased, date_stored, picture_urls, notes,
        created_by, created_at
      FROM pickup_inventory 
      WHERE deleted_at IS NULL 
      ORDER BY date_stored DESC, created_at DESC`
    );

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Get pickup inventory error:', error);
    res.status(500).json({ error: 'Failed to get pickup inventory' });
  }
});

// GET /api/inventory-log/pickup/:id - Get single pickup item
router.get('/pickup/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        id, customer_name, phone, date_purchased, date_stored, picture_urls, notes,
        created_by, created_at
      FROM pickup_inventory 
      WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Get pickup item error:', error);
    res.status(500).json({ error: 'Failed to get pickup item' });
  }
});

// POST /api/inventory-log/pickup - Create pickup inventory item
router.post('/pickup', upload.array('pictures', 10), async (req, res) => {
  const { customer_name, phone, date_purchased, date_stored, notes } = req.body;

  // Validation
  if (!customer_name || !phone || !date_purchased || !date_stored) {
    // Delete uploaded files if validation fails
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    return res.status(400).json({ error: 'Customer name, phone, purchase date, and pickup date are required' });
  }

  try {
    const db = req.app.locals.db;
    
    // Get picture URLs
    const pictureUrls = req.files ? req.files.map(file => `/uploads/pickup/${file.filename}`) : [];

    const result = await db.query(
      `INSERT INTO pickup_inventory (customer_name, phone, date_purchased, date_stored, picture_urls, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, customer_name, phone, date_purchased, date_stored, picture_urls, notes, created_by, created_at`,
      [customer_name, phone, date_purchased, date_stored, pictureUrls, notes || null, req.user.id]
    );

    res.status(201).json({ 
      message: 'Pickup inventory item created successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Create pickup inventory error:', error);
    
    // Delete uploaded files if database insert failed
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    
    res.status(500).json({ error: 'Failed to create pickup inventory item' });
  }
});

// PUT /api/inventory-log/pickup/:id - Update pickup inventory item
router.put('/pickup/:id', upload.array('pictures', 10), async (req, res) => {
  const { id } = req.params;
  const { customer_name, phone, date_purchased, date_stored, notes, keep_existing_photos } = req.body;

  // Validation
  if (!customer_name || !phone || !date_purchased || !date_stored) {
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    return res.status(400).json({ error: 'Customer name, phone, purchase date, and pickup date are required' });
  }

  try {
    const db = req.app.locals.db;

    // Get existing item
    const existingResult = await db.query(
      'SELECT picture_urls FROM pickup_inventory WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existingResult.rows.length === 0) {
      if (req.files) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        });
      }
      return res.status(404).json({ error: 'Item not found' });
    }

    const oldPictureUrls = existingResult.rows[0].picture_urls || [];

    // Determine new picture URLs
    let pictureUrls = [];
    
    if (keep_existing_photos === 'true') {
      // Keep existing photos and add new ones
      pictureUrls = [...oldPictureUrls];
      if (req.files && req.files.length > 0) {
        const newUrls = req.files.map(file => `/uploads/pickup/${file.filename}`);
        pictureUrls = [...pictureUrls, ...newUrls];
      }
    } else {
      // Replace all photos with new ones
      if (req.files && req.files.length > 0) {
        pictureUrls = req.files.map(file => `/uploads/pickup/${file.filename}`);
        
        // Delete old photos
        oldPictureUrls.forEach(url => {
          const filePath = path.join(__dirname, '../..', url);
          fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting old photo:', err);
          });
        });
      } else {
        // No new photos, keep existing if flag is set
        pictureUrls = oldPictureUrls;
      }
    }

    // Update item
    const result = await db.query(
      `UPDATE pickup_inventory 
       SET customer_name = $1, phone = $2, date_purchased = $3, date_stored = $4, picture_urls = $5, notes = $6
       WHERE id = $7 AND deleted_at IS NULL
       RETURNING id, customer_name, phone, date_purchased, date_stored, picture_urls, notes, created_by, created_at`,
      [customer_name, phone, date_purchased, date_stored, pictureUrls, notes || null, id]
    );

    res.json({ 
      message: 'Pickup inventory item updated successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Update pickup inventory error:', error);
    
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    
    res.status(500).json({ error: 'Failed to update pickup inventory item' });
  }
});

// DELETE /api/inventory-log/pickup/:id - Soft delete pickup inventory item
router.delete('/pickup/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE pickup_inventory 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Pickup inventory item deleted successfully' });
  } catch (error) {
    console.error('Delete pickup inventory error:', error);
    res.status(500).json({ error: 'Failed to delete pickup inventory item' });
  }
});

// ==================== DELIVERY INVENTORY ====================

// GET /api/inventory-log/delivery - Get all delivery inventory
router.get('/delivery', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        id, customer_name, phone, delivery_address, date_scheduled, picture_urls, notes,
        created_by, created_at
      FROM delivery_inventory 
      WHERE deleted_at IS NULL 
      ORDER BY date_scheduled DESC, created_at DESC`
    );

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Get delivery inventory error:', error);
    res.status(500).json({ error: 'Failed to get delivery inventory' });
  }
});

// GET /api/inventory-log/delivery/:id - Get single delivery item
router.get('/delivery/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    
    const result = await db.query(
      `SELECT 
        id, customer_name, phone, delivery_address, date_scheduled, picture_urls, notes,
        created_by, created_at
      FROM delivery_inventory 
      WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Get delivery item error:', error);
    res.status(500).json({ error: 'Failed to get delivery item' });
  }
});

// POST /api/inventory-log/delivery - Create delivery inventory item
router.post('/delivery', upload.array('pictures', 10), async (req, res) => {
  const { customer_name, phone, delivery_address, date_scheduled, notes } = req.body;

  // Validation
  if (!customer_name || !phone || !delivery_address || !date_scheduled) {
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    return res.status(400).json({ error: 'Customer name, phone, delivery address, and date are required' });
  }

  try {
    const db = req.app.locals.db;
    
    // Get picture URLs
    const pictureUrls = req.files ? req.files.map(file => `/uploads/delivery/${file.filename}`) : [];

    const result = await db.query(
      `INSERT INTO delivery_inventory (customer_name, phone, delivery_address, date_scheduled, picture_urls, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, customer_name, phone, delivery_address, date_scheduled, picture_urls, notes, created_by, created_at`,
      [customer_name, phone, delivery_address, date_scheduled, pictureUrls, notes || null, req.user.id]
    );

    res.status(201).json({ 
      message: 'Delivery inventory item created successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Create delivery inventory error:', error);
    
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    
    res.status(500).json({ error: 'Failed to create delivery inventory item' });
  }
});

// PUT /api/inventory-log/delivery/:id - Update delivery inventory item
router.put('/delivery/:id', upload.array('pictures', 10), async (req, res) => {
  const { id } = req.params;
  const { customer_name, phone, delivery_address, date_scheduled, notes, keep_existing_photos } = req.body;

  // Validation
  if (!customer_name || !phone || !delivery_address || !date_scheduled) {
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    return res.status(400).json({ error: 'Customer name, phone, delivery address, and date are required' });
  }

  try {
    const db = req.app.locals.db;

    // Get existing item
    const existingResult = await db.query(
      'SELECT picture_urls FROM delivery_inventory WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existingResult.rows.length === 0) {
      if (req.files) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        });
      }
      return res.status(404).json({ error: 'Item not found' });
    }

    const oldPictureUrls = existingResult.rows[0].picture_urls || [];

    // Determine new picture URLs
    let pictureUrls = [];
    
    if (keep_existing_photos === 'true') {
      // Keep existing photos and add new ones
      pictureUrls = [...oldPictureUrls];
      if (req.files && req.files.length > 0) {
        const newUrls = req.files.map(file => `/uploads/delivery/${file.filename}`);
        pictureUrls = [...pictureUrls, ...newUrls];
      }
    } else {
      // Replace all photos with new ones
      if (req.files && req.files.length > 0) {
        pictureUrls = req.files.map(file => `/uploads/delivery/${file.filename}`);
        
        // Delete old photos
        oldPictureUrls.forEach(url => {
          const filePath = path.join(__dirname, '../..', url);
          fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting old photo:', err);
          });
        });
      } else {
        pictureUrls = oldPictureUrls;
      }
    }

    // Update item
    const result = await db.query(
      `UPDATE delivery_inventory 
       SET customer_name = $1, phone = $2, delivery_address = $3, date_scheduled = $4, picture_urls = $5, notes = $6
       WHERE id = $7 AND deleted_at IS NULL
       RETURNING id, customer_name, phone, delivery_address, date_scheduled, picture_urls, notes, created_by, created_at`,
      [customer_name, phone, delivery_address, date_scheduled, pictureUrls, notes || null, id]
    );

    res.json({ 
      message: 'Delivery inventory item updated successfully',
      item: result.rows[0] 
    });
  } catch (error) {
    console.error('Update delivery inventory error:', error);
    
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    
    res.status(500).json({ error: 'Failed to update delivery inventory item' });
  }
});

// DELETE /api/inventory-log/delivery/:id - Soft delete delivery inventory item
router.delete('/delivery/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE delivery_inventory 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Delivery inventory item deleted successfully' });
  } catch (error) {
    console.error('Delete delivery inventory error:', error);
    res.status(500).json({ error: 'Failed to delete delivery inventory item' });
  }
});

module.exports = router;