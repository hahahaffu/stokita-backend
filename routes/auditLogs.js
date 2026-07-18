const express = require('express');
const router = express.Router();

const db = require('../db');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        al.id,
        u.name AS user,
        al.action,
        al.table_name,
        al.record_id,
        al.role,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error('AUDIT LOG ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;