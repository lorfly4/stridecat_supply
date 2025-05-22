const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'stridecat_supply',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Akugataumales1',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

module.exports = pool; // ⚠️ langsung export pool, bukan function callback
