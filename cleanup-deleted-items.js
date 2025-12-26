// cleanup-deleted-items.js
// Script to permanently delete pickup and delivery items that were soft-deleted more than 7 days ago
// Run this script periodically (e.g., daily via cron job)

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanupOldDeletedItems() {
  const client = await pool.connect();
  
  try {
    console.log('Starting cleanup of old deleted items...');
    console.log('Current time:', new Date().toISOString());
    
    // Get pickup items to permanently delete (older than 7 days)
    const pickupItems = await client.query(
      `SELECT id, picture_urls, deleted_at 
       FROM pickup_inventory 
       WHERE deleted_at IS NOT NULL 
         AND deleted_at <= NOW() - INTERVAL '7 days'`
    );
    
    console.log(`Found ${pickupItems.rows.length} pickup items to permanently delete`);
    
    // Delete pickup item photos from filesystem
    const baseUploadDir = process.env.UPLOAD_DIR || 'uploads';
    const uploadPath = path.isAbsolute(baseUploadDir) 
      ? baseUploadDir
      : path.join(__dirname, baseUploadDir);
    
    for (const item of pickupItems.rows) {
      const pictureUrls = item.picture_urls || [];
      pictureUrls.forEach(url => {
        const filename = url.split('/').pop();
        const filepath = path.join(uploadPath, 'pickup', filename);
        fs.unlink(filepath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.error(`Error deleting pickup photo ${filename}:`, err);
          } else {
            console.log(`Deleted pickup photo: ${filename}`);
          }
        });
      });
    }
    
    // Permanently delete pickup items from database
    const deletePickupResult = await client.query(
      `DELETE FROM pickup_inventory 
       WHERE deleted_at IS NOT NULL 
         AND deleted_at <= NOW() - INTERVAL '7 days'
       RETURNING id`
    );
    
    console.log(`Permanently deleted ${deletePickupResult.rows.length} pickup items from database`);
    
    // Get delivery items to permanently delete (older than 7 days)
    const deliveryItems = await client.query(
      `SELECT id, picture_urls, deleted_at 
       FROM delivery_inventory 
       WHERE deleted_at IS NOT NULL 
         AND deleted_at <= NOW() - INTERVAL '7 days'`
    );
    
    console.log(`Found ${deliveryItems.rows.length} delivery items to permanently delete`);
    
    // Delete delivery item photos from filesystem
    for (const item of deliveryItems.rows) {
      const pictureUrls = item.picture_urls || [];
      pictureUrls.forEach(url => {
        const filename = url.split('/').pop();
        const filepath = path.join(uploadPath, 'delivery', filename);
        fs.unlink(filepath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.error(`Error deleting delivery photo ${filename}:`, err);
          } else {
            console.log(`Deleted delivery photo: ${filename}`);
          }
        });
      });
    }
    
    // Permanently delete delivery items from database
    const deleteDeliveryResult = await client.query(
      `DELETE FROM delivery_inventory 
       WHERE deleted_at IS NOT NULL 
         AND deleted_at <= NOW() - INTERVAL '7 days'
       RETURNING id`
    );
    
    console.log(`Permanently deleted ${deleteDeliveryResult.rows.length} delivery items from database`);
    
    const totalDeleted = deletePickupResult.rows.length + deleteDeliveryResult.rows.length;
    console.log(`\nCleanup complete! Total items permanently deleted: ${totalDeleted}`);
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

// Run cleanup if executed directly
if (require.main === module) {
  cleanupOldDeletedItems()
    .then(result => {
      console.log('\nSummary:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOldDeletedItems };