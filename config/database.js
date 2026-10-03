const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('❌ Neon database error:', err.message);
});

async function testDatabaseConnection() {
  const result = await pool.query('SELECT NOW() AS now');
  console.log('✅ Neon database connected:', result.rows[0].now);
}

module.exports = {
  pool,
  testDatabaseConnection
};
