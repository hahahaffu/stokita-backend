const db = require('../db');

module.exports = async ({ user_id, action, table, record_id, role }) => {
  try {
    await db.query(
      'INSERT INTO audit_logs (user_id, action, table_name, record_id, role) VALUES (?, ?, ?, ?, ?)',
      [user_id, action, table, record_id, role || null]
    );
  } catch (err) {
    console.error('AUDIT LOG ERROR:', err);
  }
};