/**
 * Simple backend server for saving note submissions
 * 
 * Run with: node server.js
 * Or with nodemon for auto-reload: npx nodemon server.js
 * 
 * Uses PostgreSQL on Railway (via DATABASE_URL) or SQLite locally
 */

const http = require('http');
const url = require('url');
const { parse } = require('querystring');

const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL;
const RAILWAY_ENVIRONMENT = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_ID;

// Use PostgreSQL if DATABASE_URL is set (Railway), otherwise SQLite (local)
// On Railway, we MUST have DATABASE_URL, so fail fast if it's missing
let db;
let dbType;

// Initialize database and start server
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // On Railway, DATABASE_URL is required
    if (RAILWAY_ENVIRONMENT && !DATABASE_URL) {
      console.error('ERROR: Railway environment detected but DATABASE_URL is not set!');
      console.error('Please add a PostgreSQL database to your Railway project.');
      reject(new Error('DATABASE_URL required on Railway but not set'));
      return;
    }
    
    if (DATABASE_URL) {
      // PostgreSQL (Railway production)
      const { Client } = require('pg');
      dbType = 'postgresql';
      
      // Railway PostgreSQL requires SSL
      // Check if connection string includes SSL requirement or if we're on Railway
      const needsSSL = DATABASE_URL.includes('railway') || RAILWAY_ENVIRONMENT;
      
      const client = new Client({
        connectionString: DATABASE_URL,
        ssl: needsSSL ? { rejectUnauthorized: false } : false
      });
      
      console.log('Connecting to PostgreSQL...', { hasSSL: needsSSL, hasRailwayEnv: !!RAILWAY_ENVIRONMENT });
      
      client.connect()
        .then(() => {
          console.log('Connected to PostgreSQL database');
          // Create table if it doesn't exist
          return client.query(`
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
        })
        .then(() => {
          console.log('Database table ready');
          db = client;
          resolve();
        })
        .catch(err => {
          console.error('Database connection error:', err);
          reject(err);
        });
    } else {
      // SQLite (local development)
      const sqlite3 = require('sqlite3').verbose();
      const path = require('path');
      const DB_PATH = path.join(__dirname, 'notes.db');
      
      dbType = 'sqlite';
      db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          // Create table if it doesn't exist
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
          `, (err) => {
            if (err) {
              console.error('Error creating table:', err);
              reject(err);
            } else {
              console.log('Database table ready');
              resolve();
            }
          });
        }
      });
    }
  });
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // Log incoming requests (for debugging)
  console.log(`${req.method} ${parsedUrl.pathname} - DB type: ${dbType || 'not initialized'}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.method === 'GET' && parsedUrl.pathname === '/api/health') {
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({ 
      status: 'ok',
      dbType: dbType || 'not initialized',
      dbConnected: !!db,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // POST /api/submit - Save a note submission
  if (req.method === 'POST' && parsedUrl.pathname === '/api/submit') {
    // Check if database is ready
    if (!db || !dbType) {
      console.error('Database not initialized! dbType:', dbType, 'db:', !!db);
      res.writeHead(503, corsHeaders);
      res.end(JSON.stringify({ error: 'Database not initialized' }));
      return;
    }
    
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Received submission:', { noteId: data.noteId, messageLength: data.message?.length });
        
        // Validate required fields
        if (!data.message || !data.noteId) {
          console.error('Validation failed:', { hasMessage: !!data.message, hasNoteId: !!data.noteId });
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ error: 'Missing required fields: message and noteId' }));
          return;
        }
        
        const values = [
          data.noteId,
          data.notePrompt || null,
          data.context || null,
          data.message,
          data.email || null,
          data.timestamp || new Date().toISOString()
        ];
        
        // Insert into database (PostgreSQL or SQLite)
        if (dbType === 'postgresql') {
          // PostgreSQL
          db.query(
            `INSERT INTO notes (note_id, note_prompt, context, message, email, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            values
          )
          .then(result => {
            const id = result.rows[0].id;
            console.log(`Note saved: ID ${id}`);
            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({ 
              success: true, 
              id: id 
            }));
          })
          .catch(err => {
            console.error('PostgreSQL database error:', err.message);
            console.error('Full error:', err);
            res.writeHead(500, corsHeaders);
            res.end(JSON.stringify({ error: 'Failed to save note', details: err.message }));
          });
        } else {
          // SQLite
          db.run(
            `INSERT INTO notes (note_id, note_prompt, context, message, email, timestamp)
             VALUES (?, ?, ?, ?, ?, ?)`,
            values,
            function(err) {
              if (err) {
                console.error('SQLite database error:', err.message);
                console.error('Full error:', err);
                res.writeHead(500, corsHeaders);
                res.end(JSON.stringify({ error: 'Failed to save note', details: err.message }));
              } else {
                console.log(`Note saved: ID ${this.lastID}`);
                res.writeHead(200, corsHeaders);
                res.end(JSON.stringify({ 
                  success: true, 
                  id: this.lastID 
                }));
              }
            }
          );
        }
      } catch (err) {
        console.error('Parse error:', err);
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }
  
  // GET /api/notes - Retrieve all notes (for your viewing)
  else if (req.method === 'GET' && parsedUrl.pathname === '/api/notes') {
    if (dbType === 'postgresql') {
      // PostgreSQL
      db.query('SELECT * FROM notes ORDER BY created_at DESC')
        .then(result => {
          res.writeHead(200, corsHeaders);
          res.end(JSON.stringify({ notes: result.rows }));
        })
        .catch(err => {
          console.error('Database error:', err);
          res.writeHead(500, corsHeaders);
          res.end(JSON.stringify({ error: 'Failed to retrieve notes' }));
        });
    } else {
      // SQLite
      db.all(
        'SELECT * FROM notes ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) {
            console.error('Database error:', err);
            res.writeHead(500, corsHeaders);
            res.end(JSON.stringify({ error: 'Failed to retrieve notes' }));
          } else {
            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({ notes: rows }));
          }
        }
      );
    }
  }
  
  else {
    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Initialize database and start server
initializeDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`API endpoint: http://localhost:${PORT}/api/submit`);
      console.log(`View notes: http://localhost:${PORT}/api/notes`);
      console.log(`Database type: ${dbType}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (dbType === 'postgresql') {
    db.end()
      .then(() => {
        console.log('Database closed');
        process.exit(0);
      })
      .catch(err => {
        console.error('Error closing database:', err);
        process.exit(1);
      });
  } else {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database closed');
      }
      process.exit(0);
    });
  }
});
