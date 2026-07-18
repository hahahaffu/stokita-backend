const express = require('express');
const router = express.Router();

const db = require('../db');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

/* ================= DAILY ================= */
router.get('/daily', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        COUNT(*) AS total_transaksi,
        IFNULL(SUM(total),0) AS total_penjualan
      FROM sales
      WHERE DATE(created_at) = CURDATE()
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error('DAILY REPORT ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ================= MONTHLY ================= */
router.get('/monthly', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        COUNT(*) AS total_transaksi,
        IFNULL(SUM(total),0) AS total_penjualan
      FROM sales
      WHERE MONTH(created_at) = MONTH(CURDATE())
      AND YEAR(created_at) = YEAR(CURDATE())
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error('MONTHLY REPORT ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ================= LIST ================= */
router.get('/list', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        s.id,
        s.total,
        s.created_at,
        u.name AS admin
      FROM sales s
      JOIN users u ON u.id = s.admin_id
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('LIST SALES ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ================= BEST SELLER ================= */
router.get('/best-seller', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id,
        p.name,
        p.price,
        p.stock,
        p.image,
        SUM(si.quantity) AS total_terjual
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      GROUP BY p.id, p.name, p.price, p.stock, p.image
      ORDER BY total_terjual DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'server error' });
  }
});

/* ================= SALES CHART ================= */
router.get('/sales-chart', auth, isAdmin, async (req, res) => {
  const { type } = req.query;

  let query = '';

  if (type === 'daily') {
    // ✅ DATE_FORMAT supaya label selalu konsisten YYYY-MM-DD
    // ✅ INTERVAL 6 DAY supaya include hari ini = 7 hari total
    query = `
      SELECT 
        DATE_FORMAT(s.created_at, '%Y-%m-%d') AS label,
        IFNULL(SUM(si.quantity * si.price), 0) AS penjualan,
        IFNULL(SUM(si.quantity * (si.price - si.cost_price)), 0) AS profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE_FORMAT(s.created_at, '%Y-%m-%d')
      ORDER BY label ASC
    `;
  }

  if (type === 'monthly') {
    // ✅ DATE_FORMAT supaya label selalu YYYY-MM-DD dengan zero-padding
    query = `
      SELECT
        DATE_FORMAT(s.created_at, '%Y-%m-%d') AS label,
        IFNULL(SUM(si.quantity * si.price), 0) AS penjualan,
        IFNULL(SUM(si.quantity * (si.price - si.cost_price)), 0) AS profit
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE MONTH(s.created_at) = MONTH(CURDATE())
      AND YEAR(s.created_at) = YEAR(CURDATE())
      GROUP BY DATE_FORMAT(s.created_at, '%Y-%m-%d')
      ORDER BY label
    `;
  }

  if (type === 'yearly') {
    query = `
      SELECT
        DATE_FORMAT(s.created_at, '%Y-%m') AS label,
        IFNULL(SUM(si.quantity * si.price), 0) AS penjualan,
        IFNULL(SUM(si.quantity * (si.price - si.cost_price)), 0) AS profit
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE YEAR(s.created_at) = YEAR(CURDATE())
      GROUP BY DATE_FORMAT(s.created_at, '%Y-%m')
      ORDER BY label
    `;
  }

  if (!query) {
    return res.status(400).json({ message: 'type tidak valid' });
  }

  try {
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('CHART ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ================= SUMMARY ================= */
router.get('/summary', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        IFNULL(SUM(si.quantity * si.price), 0)                          AS total_penjualan,
        IFNULL(SUM(si.quantity * si.cost_price), 0)                     AS total_modal,
        IFNULL(SUM(si.quantity * (si.price - si.cost_price)), 0)        AS total_profit,
        COUNT(DISTINCT si.sale_id)                                       AS total_transaksi,
        ROUND(
          IFNULL(
            SUM(si.quantity * (si.price - si.cost_price))
            / NULLIF(SUM(si.quantity * si.cost_price), 0) * 100,
          0),
        2)                                                               AS margin_profit
      FROM sale_items si
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error('SUMMARY ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;