const { dbQuery, initDb } = require('./db');

async function debug() {
  await initDb();
  console.log('--- USERS ---');
  const users = await dbQuery.all('SELECT id, full_name, email, role FROM users');
  console.log(users);

  console.log('--- OFFICIALS ---');
  const officials = await dbQuery.all('SELECT * FROM officials');
  console.log(officials);

  console.log('--- APPOINTMENTS ---');
  const appointments = await dbQuery.all('SELECT * FROM appointments');
  console.log(appointments);
}

debug();
