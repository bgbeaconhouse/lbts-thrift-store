// cleanup-deleted-items.js
// Permanently deletes soft-deleted records older than 7 days and their images:
//   - pickup_forms
//   - delivery_forms
//   - exclusive_items
//   - discount_items
// Also permanently deletes daily report images (+ their DB records) older than 90 days.
// Waivers, donations, and communication posts are NOT touched.

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function deleteFile(filepath) {
  fs.unlink(filepath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error(`Error deleting file ${filepath}:`, err);
    } else if (!err) {
      console.log(`Deleted file: ${filepath}`);
    }
  });
}

async function cleanupOldDeletedForms() {
  const client = await pool.connect();

  try {
    console.log('=== Starting cleanup ===');
    console.log('Current time:', new Date().toISOString());

    const baseUploadDir = process.env.UPLOAD_DIR || 'uploads';
    const uploadPath = path.isAbsolute(baseUploadDir)
      ? baseUploadDir
      : path.join(__dirname, baseUploadDir);

    // ── PICKUP FORMS ──────────────────────────────────────────────
    const pickupForms = await client.query(
      `SELECT id, picture_urls
       FROM pickup_forms
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'`
    );
    console.log(`\nFound ${pickupForms.rows.length} pickup forms to permanently delete`);

    for (const form of pickupForms.rows) {
      (form.picture_urls || []).forEach(url => {
        deleteFile(path.join(uploadPath, 'pickup', url.split('/').pop()));
      });
    }

    const deletePickupResult = await client.query(
      `DELETE FROM pickup_forms
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'
       RETURNING id`
    );
    console.log(`Permanently deleted ${deletePickupResult.rows.length} pickup forms from database`);

    // ── DELIVERY FORMS ────────────────────────────────────────────
    const deliveryForms = await client.query(
      `SELECT id, picture_urls
       FROM delivery_forms
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'`
    );
    console.log(`\nFound ${deliveryForms.rows.length} delivery forms to permanently delete`);

    for (const form of deliveryForms.rows) {
      (form.picture_urls || []).forEach(url => {
        deleteFile(path.join(uploadPath, 'delivery', url.split('/').pop()));
      });
    }

    const deleteDeliveryResult = await client.query(
      `DELETE FROM delivery_forms
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'
       RETURNING id`
    );
    console.log(`Permanently deleted ${deleteDeliveryResult.rows.length} delivery forms from database`);

    // ── EXCLUSIVE ITEMS ───────────────────────────────────────────
    const exclusiveItems = await client.query(
      `SELECT id, picture_url
       FROM exclusive_items
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'`
    );
    console.log(`\nFound ${exclusiveItems.rows.length} exclusive items to permanently delete`);

    for (const item of exclusiveItems.rows) {
      if (item.picture_url) {
        deleteFile(path.join(uploadPath, 'exclusive', item.picture_url.split('/').pop()));
      }
    }

    const deleteExclusiveResult = await client.query(
      `DELETE FROM exclusive_items
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'
       RETURNING id`
    );
    console.log(`Permanently deleted ${deleteExclusiveResult.rows.length} exclusive items from database`);

    // ── DISCOUNT ITEMS ────────────────────────────────────────────
    const discountItems = await client.query(
      `SELECT id, picture_urls
       FROM discount_items
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'`
    );
    console.log(`\nFound ${discountItems.rows.length} discount items to permanently delete`);

    for (const item of discountItems.rows) {
      (item.picture_urls || []).forEach(url => {
        deleteFile(path.join(uploadPath, 'discount', url.split('/').pop()));
      });
    }

    const deleteDiscountResult = await client.query(
      `DELETE FROM discount_items
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'
       RETURNING id`
    );
    console.log(`Permanently deleted ${deleteDiscountResult.rows.length} discount items from database`);

    // ── DAILY REPORT IMAGES (older than 90 days) ──────────────────
    // Images are stored in daily_report_images, linked to daily_reports via report_id.
    // We delete the image files and their DB records for reports older than 90 days.
    // The daily_reports rows themselves are kept for historical record.
    const oldReportImages = await client.query(
      `SELECT dri.id, dri.image_data
       FROM daily_report_images dri
       JOIN daily_reports dr ON dri.report_id = dr.id
       WHERE dr.report_date <= CURRENT_DATE - INTERVAL '90 days'`
    );
    console.log(`\nFound ${oldReportImages.rows.length} daily report images older than 90 days to delete`);

    for (const img of oldReportImages.rows) {
      if (img.image_data && img.image_data.startsWith('/uploads/')) {
        deleteFile(path.join(uploadPath, img.image_data.replace('/uploads/', '')));
      }
    }

    const deleteReportImagesResult = await client.query(
      `DELETE FROM daily_report_images
       WHERE id IN (
         SELECT dri.id
         FROM daily_report_images dri
         JOIN daily_reports dr ON dri.report_id = dr.id
         WHERE dr.report_date <= CURRENT_DATE - INTERVAL '90 days'
       )
       RETURNING id`
    );
    console.log(`Permanently deleted ${deleteReportImagesResult.rows.length} daily report image records from database`);

    // ── SUMMARY ───────────────────────────────────────────────────
    console.log('\n=== Cleanup complete! ===');
    console.log('Finished at:', new Date().toISOString());

    const summary = {
      pickupDeleted: deletePickupResult.rows.length,
      deliveryDeleted: deleteDeliveryResult.rows.length,
      exclusiveDeleted: deleteExclusiveResult.rows.length,
      discountDeleted: deleteDiscountResult.rows.length,
      reportImagesDeleted: deleteReportImagesResult.rows.length,
      totalFormsDeleted:
        deletePickupResult.rows.length +
        deleteDeliveryResult.rows.length +
        deleteExclusiveResult.rows.length +
        deleteDiscountResult.rows.length
    };

    return summary;

  } catch (error) {
    console.error('Cleanup error:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  cleanupOldDeletedForms()
    .then(result => {
      console.log('\nSummary:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOldDeletedForms };