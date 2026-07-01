const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.resolve(__dirname, 'appointment_booking.db');

let db = null;
let SQL = null;
let dbInitialized = false;

// Helper to save the WebAssembly database to the disk
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Initialize sql.js database
async function loadDb() {
  SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('Loaded SQLite database from file:', dbPath);
  } else {
    db = new SQL.Database();
    console.log('Created new in-memory SQLite database.');
    saveDb();
  }
}

// Wrapper for queries to match SQLite3 Promise interface
const dbQuery = {
  async run(sql, params = []) {
    if (!dbInitialized) await initDb();
    
    // sql.js expects bind parameters (e.g. arrays)
    // Run the statement
    db.run(sql, params);
    
    // Get last insert ID (Must query before saveDb() exports and resets state)
    const lastIdRes = db.exec("SELECT last_insert_rowid() AS id;");
    const lastID = lastIdRes[0] && lastIdRes[0].values[0] ? lastIdRes[0].values[0][0] : null;
    
    // Get changes
    const changesRes = db.exec("SELECT changes() AS changes;");
    const changes = changesRes[0] && changesRes[0].values[0] ? changesRes[0].values[0][0] : 0;
    
    saveDb(); // Persist changes
    
    return { id: lastID, changes };
  },

  async get(sql, params = []) {
    if (!dbInitialized) await initDb();
    
    const stmt = db.prepare(sql);
    stmt.bind(params);
    
    let row = null;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
    
    // If no row columns were populated or row is empty object, return null
    if (row && Object.keys(row).length === 0) {
      return null;
    }
    
    // If a primary key or crucial column is missing/null, verify if it was a real row
    // getAsObject returns `{id: null, full_name: null}` if no row was fetched in some configurations,
    // but with `stmt.step()`, it will only return true if a row is present.
    return row;
  },

  async all(sql, params = []) {
    if (!dbInitialized) await initDb();
    
    const stmt = db.prepare(sql);
    stmt.bind(params);
    
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    
    return rows;
  },

  async exec(sql) {
    if (!dbInitialized) await initDb();
    db.run(sql);
    saveDb();
  }
};

// Initialize schema tables
async function initDb() {
  if (!dbInitialized) {
    await loadDb();
    dbInitialized = true;
  }
  
  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON;');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('visitor', 'secretary', 'admin')) NOT NULL,
      matric_staff_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS officials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      office_title TEXT NOT NULL,
      secretary_user_id INTEGER,
      available_days TEXT NOT NULL,
      available_start_time TEXT NOT NULL,
      available_end_time TEXT NOT NULL,
      slot_duration_minutes INTEGER DEFAULT 30,
      buffer_duration_minutes INTEGER DEFAULT 10,
      rest_start_time TEXT DEFAULT '13:00',
      rest_end_time TEXT DEFAULT '14:00',
      FOREIGN KEY (secretary_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_user_id INTEGER NOT NULL,
      official_id INTEGER NOT NULL,
      requested_date TEXT NOT NULL,
      requested_time TEXT NOT NULL,
      purpose TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'rescheduled', 'cancelled', 'completed')) NOT NULL,
      secretary_note TEXT,
      rescheduled_date TEXT,
      rescheduled_time TEXT,
      qr_code_token TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visitor_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (official_id) REFERENCES officials(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      related_appointment_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (related_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_type TEXT NOT NULL,
      recipient TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blackout_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      official_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (official_id) REFERENCES officials(id) ON DELETE CASCADE
    );
  `);

  saveDb();
  console.log('Database tables verified/initialized.');
}

module.exports = {
  dbQuery,
  initDb
};
