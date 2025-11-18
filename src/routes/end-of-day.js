const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const baseUploadDir = process.env.UPLOAD_DIR || 'uploads';
    const uploadDir = path.isAbsolute(baseUploadDir) 
      ? path.join(baseUploadDir, 'daily-reports')
      : path.join(__dirname, '../..', baseUploadDir, 'daily-reports');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'report-' + uniqueSuffix + path.extname(file.originalname));
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

// Middleware to check if user is manager or admin
const requireManagerOrAdmin = (req, res, next) => {
    if (req.user.role === 'Manager' || req.user.role === 'Admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Manager or Admin role required.' });
    }
};

// Get end of day data for a specific date (checklist + report)
router.get('/:date', authenticateToken, async (req, res) => {
    const { date } = req.params;
    const userRole = req.user.role;
    const db = req.app.locals.db;

    try {
        // Get all checklist template items
        const templateResult = await db.query(
            'SELECT * FROM checklist_templates WHERE is_active = true ORDER BY display_order'
        );

        // Get or create checklist items for this date
        let checklistItems = await db.query(
            `SELECT dci.*, ct.item_text, ct.display_order, u.username as completed_by_name
             FROM daily_checklist_items dci
             JOIN checklist_templates ct ON dci.template_id = ct.id
             LEFT JOIN users u ON dci.completed_by = u.id
             WHERE dci.checklist_date = $1
             ORDER BY ct.display_order`,
            [date]
        );

        // If no checklist items exist for this date, create them
        if (checklistItems.rows.length === 0) {
            const insertPromises = templateResult.rows.map(template => 
                db.query(
                    `INSERT INTO daily_checklist_items (checklist_date, template_id, is_completed)
                     VALUES ($1, $2, false)
                     RETURNING *`,
                    [date, template.id]
                )
            );
            await Promise.all(insertPromises);

            // Fetch the newly created items
            checklistItems = await db.query(
                `SELECT dci.*, ct.item_text, ct.display_order, u.username as completed_by_name
                 FROM daily_checklist_items dci
                 JOIN checklist_templates ct ON dci.template_id = ct.id
                 LEFT JOIN users u ON dci.completed_by = u.id
                 WHERE dci.checklist_date = $1
                 ORDER BY ct.display_order`,
                [date]
            );
        }

        let reportData = null;

        // Only fetch report data if user is manager or admin
        if (userRole === 'Manager' || userRole === 'Admin') {
            const reportResult = await db.query(
                `SELECT dr.*, 
                        u1.username as created_by_name,
                        u2.username as updated_by_name
                 FROM daily_reports dr
                 LEFT JOIN users u1 ON dr.created_by = u1.id
                 LEFT JOIN users u2 ON dr.updated_by = u2.id
                 WHERE dr.report_date = $1`,
                [date]
            );

            if (reportResult.rows.length > 0) {
                reportData = reportResult.rows[0];

                // Get images for this report
                const imagesResult = await db.query(
                    `SELECT dri.*, u.username as uploaded_by_name
                     FROM daily_report_images dri
                     LEFT JOIN users u ON dri.uploaded_by = u.id
                     WHERE dri.report_id = $1
                     ORDER BY dri.uploaded_at`,
                    [reportData.id]
                );

                reportData.images = imagesResult.rows;
            }
        }

        res.json({
            checklist: checklistItems.rows,
            report: reportData,
            canAccessReport: userRole === 'Manager' || userRole === 'Admin'
        });

    } catch (error) {
        console.error('Error fetching end of day data:', error);
        res.status(500).json({ error: 'Failed to fetch end of day data' });
    }
});

// Toggle checklist item completion (all staff can do this)
router.post('/checklist/toggle', authenticateToken, async (req, res) => {
    const { itemId, isCompleted } = req.body;
    const userId = req.user.id;
    const db = req.app.locals.db;

    try {
        const result = await db.query(
            `UPDATE daily_checklist_items
             SET is_completed = $1,
                 completed_by = $2,
                 completed_at = $3
             WHERE id = $4
             RETURNING *`,
            [isCompleted, isCompleted ? userId : null, isCompleted ? new Date() : null, itemId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Checklist item not found' });
        }

        res.json({ success: true, item: result.rows[0] });

    } catch (error) {
        console.error('Error toggling checklist item:', error);
        res.status(500).json({ error: 'Failed to toggle checklist item' });
    }
});

// Save or update daily report (manager/admin only)
router.post('/report', authenticateToken, requireManagerOrAdmin, async (req, res) => {
    const { reportDate, cashCount, donationAmount, total } = req.body;
    const userId = req.user.id;
    const db = req.app.locals.db;

    try {
        // Check if report exists for this date
        const existingReport = await db.query(
            'SELECT * FROM daily_reports WHERE report_date = $1',
            [reportDate]
        );

        let result;

        if (existingReport.rows.length > 0) {
            // Update existing report
            result = await db.query(
                `UPDATE daily_reports
                 SET cash_count = $1,
                     donation_amount = $2,
                     total = $3,
                     updated_by = $4,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE report_date = $5
                 RETURNING *`,
                [cashCount, donationAmount, total, userId, reportDate]
            );
        } else {
            // Create new report
            result = await db.query(
                `INSERT INTO daily_reports (report_date, cash_count, donation_amount, total, created_by, updated_by)
                 VALUES ($1, $2, $3, $4, $5, $5)
                 RETURNING *`,
                [reportDate, cashCount, donationAmount, total, userId]
            );
        }

        res.json({ success: true, report: result.rows[0] });

    } catch (error) {
        console.error('Error saving daily report:', error);
        res.status(500).json({ error: 'Failed to save daily report' });
    }
});

// Upload image to daily report (manager/admin only)
router.post('/report/upload-image', authenticateToken, requireManagerOrAdmin, upload.single('image'), async (req, res) => {
    const { reportDate } = req.body;
    const userId = req.user.id;
    const db = req.app.locals.db;

    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }

    try {
        // Get or create report for this date
        let reportResult = await db.query(
            'SELECT * FROM daily_reports WHERE report_date = $1',
            [reportDate]
        );

        let reportId;

        if (reportResult.rows.length === 0) {
            // Create report if it doesn't exist
            const newReport = await db.query(
                `INSERT INTO daily_reports (report_date, created_by, updated_by)
                 VALUES ($1, $2, $2)
                 RETURNING id`,
                [reportDate, userId]
            );
            reportId = newReport.rows[0].id;
        } else {
            reportId = reportResult.rows[0].id;
        }

        // Store the file path instead of base64 data
        const imagePath = '/uploads/daily-reports/' + req.file.filename;

        // Insert image path
        const imageResult = await db.query(
            `INSERT INTO daily_report_images (report_id, image_data, uploaded_by)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [reportId, imagePath, userId]
        );

        // Get username for response
        const userResult = await db.query(
            'SELECT username FROM users WHERE id = $1',
            [userId]
        );

        const image = imageResult.rows[0];
        image.uploaded_by_name = userResult.rows[0].username;

        res.json({ success: true, image });

    } catch (error) {
        console.error('Error uploading report image:', error);
        // Delete uploaded file if database insert failed
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Delete report image (manager/admin only)
router.delete('/report/delete-image/:imageId', authenticateToken, requireManagerOrAdmin, async (req, res) => {
    const { imageId } = req.params;
    const db = req.app.locals.db;

    try {
        const result = await db.query(
            'DELETE FROM daily_report_images WHERE id = $1 RETURNING *',
            [imageId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Delete the physical file
        const imagePath = result.rows[0].image_data;
        if (imagePath && imagePath.startsWith('/uploads/')) {
            const baseUploadDir = process.env.UPLOAD_DIR || 'uploads';
            const fullPath = path.isAbsolute(baseUploadDir)
                ? path.join(baseUploadDir, imagePath.replace('/uploads/', ''))
                : path.join(__dirname, '../..', imagePath.replace('/uploads/', ''));
            
            fs.unlink(fullPath, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Error deleting report image:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

module.exports = router;