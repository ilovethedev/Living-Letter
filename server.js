/**
 * Living Letter - Backend API Server
 * 
 * Endpoints:
 *   GET  /api/health  - Health check
 *   POST /api/submit  - Submit a note
 *   GET  /api/notes   - Retrieve all notes
 * 
 * Uses PostgreSQL on Railway (DATABASE_URL) or SQLite locally
 */

const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL;

let db = null;
let dbType = null;

// ============================================
// Database Initialization
// ============================================

async function initDatabase() {
  if (DATABASE_URL) {
    // PostgreSQL (Railway)
    const { Client } = require('pg');
    dbType = 'postgresql';
    
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✓ Connected to PostgreSQL');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        note_id TEXT NOT NULL,
        note_prompt TEXT,
        context TEXT,
        message TEXT NOT NULL,
        email TEXT,
        timestamp TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    db = client;
  } else {
    // SQLite (local development)
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    dbType = 'sqlite';
    
    db = await new Promise((resolve, reject) => {
      const conn = new sqlite3.Database(path.join(__dirname, 'notes.db'), err => {
        if (err) reject(err);
        else resolve(conn);
      });
    });
    
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          note_id TEXT NOT NULL,
          note_prompt TEXT,
          context TEXT,
          message TEXT NOT NULL,
          email TEXT,
          timestamp TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, err => err ? reject(err) : resolve());
    });
    
    console.log('✓ Connected to SQLite');
  }
  
  console.log(`✓ Database ready (${dbType})`);
}

// ============================================
// Database Operations
// ============================================

async function insertNote(data) {
  const values = [
    data.noteId,
    data.notePrompt || null,
    data.context || null,
    data.message,
    data.email || null,
    data.timestamp || new Date().toISOString()
  ];
  
  if (dbType === 'postgresql') {
    const result = await db.query(
      `INSERT INTO notes (note_id, note_prompt, context, message, email, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      values
    );
    return result.rows[0].id;
  } else {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO notes (note_id, note_prompt, context, message, email, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
}

async function getAllNotes() {
  if (dbType === 'postgresql') {
    const result = await db.query('SELECT * FROM notes ORDER BY created_at DESC');
    return result.rows;
  } else {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM notes ORDER BY created_at DESC', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

// ============================================
// HTTP Server
// ============================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function json(res, status, data) {
  res.writeHead(status, CORS);
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, CORS);
    return res.end();
  }
  
  try {
    // Health check
    if (req.method === 'GET' && path === '/api/health') {
      return json(res, 200, {
        status: 'ok',
        dbType,
        dbConnected: !!db,
        timestamp: new Date().toISOString()
      });
    }
    
    // Submit note
    if (req.method === 'POST' && path === '/api/submit') {
      if (!db) return json(res, 503, { error: 'Database not ready' });
      
      const data = await parseBody(req);
      
      if (!data.message || !data.noteId) {
        return json(res, 400, { error: 'Missing required fields' });
      }
      
      const id = await insertNote(data);
      console.log(`Note saved: #${id}`);
      return json(res, 200, { success: true, id });
    }
    
    // Get notes
    if (req.method === 'GET' && path === '/api/notes') {
      if (!db) return json(res, 503, { error: 'Database not ready' });
      
      const notes = await getAllNotes();
      return json(res, 200, { notes });
    }
    
    // Not found
    json(res, 404, { error: 'Not found' });
    
  } catch (err) {
    console.error('Error:', err.message);
    json(res, 500, { error: err.message });
  }
});

// ============================================
// Startup
// ============================================

initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close(() => {
    if (dbType === 'postgresql') db.end();
    else db.close();
    process.exit(0);
  });
});
