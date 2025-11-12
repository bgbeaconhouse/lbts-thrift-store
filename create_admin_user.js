// create_admin_user.js
// Run this script to create an admin user with a properly hashed password
// Usage: node create_admin_user.js

require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Database configuration from environment variables
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'lbts_store',
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
      }
);

async function createAdminUser() {
  const username = 'admin';
  const password = 'admin123'; // Default password - user should change after first login
  const saltRounds = 10;

  try {
    // Hash the password
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Insert admin user
    const query = `
      INSERT INTO users (username, password_hash, role, email, furniture_alerts, clothing_alerts, bricabrac_alerts)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (username) DO UPDATE 
      SET password_hash = $2
      RETURNING id, username, role;
    `;
    
    const values = [username, passwordHash, 'Admin', 'admin@lbts.local', true, true, true];
    const result = await pool.query(query, values);
    
    console.log('✅ Admin user created successfully!');
    console.log('Username:', result.rows[0].username);
    console.log('Password:', password);
    console.log('Role:', result.rows[0].role);
    console.log('\n⚠️  IMPORTANT: Change this password after first login!');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await pool.end();
  }
}

createAdminUser();