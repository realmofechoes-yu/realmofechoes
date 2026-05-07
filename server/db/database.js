const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Support both PostgreSQL (DATABASE_URL) and SQLite fallback mode
const DATABASE_URL = process.env.DATABASE_URL;

let pool;

function getPool() {
  if (!pool) {
    if (!DATABASE_URL) {
      console.error('❌ DATABASE_URL not set. Please configure a PostgreSQL connection string.');
      process.exit(1);
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      client_encoding: 'UTF8'
    });
    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
    });
  }
  return pool;
}

async function initSchema() {
  const p = getPool();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  try {
    await p.query(schema);
    // Ensure revival_count exists for characters
    await p.query('ALTER TABLE characters ADD COLUMN IF NOT EXISTS revival_count INTEGER DEFAULT 0');
    console.log('✅ Database schema initialized');
  } catch (err) {
    // Tables may already exist, that's fine
    if (err.code === '42P07') {
      console.log('✅ Database schema already exists');
    } else {
      console.error('Schema init error:', err.message);
      throw err;
    }
  }
}

async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

async function getOne(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

async function getAll(text, params) {
  const result = await query(text, params);
  return result.rows;
}

async function run(text, params) {
  const result = await query(text, params);
  return result;
}

async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed');
  }
}

module.exports = { getPool, initSchema, query, getOne, getAll, run, closeDb };
