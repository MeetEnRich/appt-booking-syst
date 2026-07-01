const { initDb, dbQuery } = require('./db');
const initSqlJs = require('sql.js');

async function test() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    )
  `);

  console.log('--- TEST 1: db.run then db.exec ---');
  db.run("INSERT INTO users (name) VALUES (?)", ["Alice"]);
  const r1 = db.exec("SELECT last_insert_rowid();");
  console.log('r1:', JSON.stringify(r1)); // Check if it gets the ID

  console.log('--- TEST 2: Chained exec ---');
  // Chained SQL statements
  const r2 = db.exec("INSERT INTO users (name) VALUES ('Bob'); SELECT last_insert_rowid() AS id; SELECT changes() AS changes;");
  console.log('r2:', JSON.stringify(r2));
}

test();
