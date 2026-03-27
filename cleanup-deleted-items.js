// cleanup-deleted-items.js
// Permanently deletes pickup and delivery forms that were soft-deleted more than 7 days ago
// Also deletes their associated image files from disk
// Waivers, donations, discount items, and communication posts are NOT touched

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanupOldDeletedForms() {
  const client = await pool.connect();

  try {
    console.log('Starting cleanup of old deleted forms...');
    console.log('Current time:', new Date().toISOString());

    const baseUploadDir = process.env.UPLOAD_DIR || 'uploads';
    const uploadPath = path.isAbsolute(baseUploadDir)
      ? baseUploadDir
      : path.join(__dirname, baseUploadDir);

    // ── PICKUP FORMS ──────────────────────────────────────────────
    const pickupForms = await client.query(
      `SELECT id, picture_urls, deleted_at
       FROM pickup_forms
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'`
    );

    console.log(`Found ${pickupForms.rows.length} pickup forms to permanently delete`);

    for (const form of pickupForms.rows) {
      const pictureUrls = form.picture_urls || [];
      pictureUrls.forEach(url => {
        const filename = url.split('/').pop();
        const filepath = path.join(uploadPath, 'pickup', filename);
        fs.unlink(filepath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.error(`Error deleting pickup photo ${filename}:`, err);
          } else if (!err) {
            console.log(`Deleted pickup photo: ${filename}`);
          }
        });
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
      `SELECT id, picture_urls, deleted_at
       FROM delivery_forms
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'`
    );

    console.log(`Found ${deliveryForms.rows.length} delivery forms to permanently delete`);

    for (const form of deliveryForms.rows) {
      const pictureUrls = form.picture_urls || [];
      pictureUrls.forEach(url => {
        const filename = url.split('/').pop();
        const filepath = path.join(uploadPath, 'delivery', filename);
        fs.unlink(filepath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.error(`Error deleting delivery photo ${filename}:`, err);
          } else if (!err) {
            console.log(`Deleted delivery photo: ${filename}`);
          }
        });
      });
    }

    const deleteDeliveryResult = await client.query(
      `DELETE FROM delivery_forms
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= NOW() - INTERVAL '7 days'
       RETURNING id`
    );

    console.log(`Permanently deleted ${deleteDeliveryResult.rows.length} delivery forms from database`);

    // ── SUMMARY ───────────────────────────────────────────────────
    const totalDeleted = deletePickupResult.rows.length + deleteDeliveryResult.rows.length;
    console.log(`\nCleanup complete! Total forms permanently deleted: ${totalDeleted}`);
    console.log('Finished at:', new Date().toISOString());

    return {
      pickupDeleted: deletePickupResult.rows.length,
      deliveryDeleted: deleteDeliveryResult.rows.length,
      totalDeleted
    };

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