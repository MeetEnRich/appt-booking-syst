const { dbQuery } = require('./db');

/**
 * Simulates sending an email by printing it to the console and saving it in the db.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} body - Email body message
 */
async function sendSimulatedEmail(to, subject, body) {
  const line = '='.repeat(60);
  console.log(`\n${line}`);
  console.log(`[SIMULATED EMAIL DISPATCH]`);
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:    ${body}`);
  console.log(`${line}\n`);

  try {
    await dbQuery.run(
      `INSERT INTO system_logs (log_type, recipient, subject, message) VALUES (?, ?, ?, ?)`,
      ['email', to, subject, body]
    );
  } catch (error) {
    console.error('Failed to log simulated email to database:', error.message);
  }
}

module.exports = {
  sendSimulatedEmail
};
