require('dotenv').config({ path: 'env.' });

const { pool } = require('./config/database');

async function createUsersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('✅ جدول users تم إنشاؤه بنجاح في Neon');
  } catch (error) {
    console.error('❌ فشل إنشاء جدول users:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createUsersTable();
