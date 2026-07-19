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
        IFNULL(SUM(transaksi),0) AS total_transaksi,
        IFNULL(SUM(penjualan),0) AS total_penjualan
      FROM (
        SELECT 1 AS transaksi, total AS penjualan 
        FROM sales 
        WHERE DATE(created_at) = CURDATE()
        
        UNION ALL
        
        SELECT 1 AS transaksi, total AS penjualan 
        FROM orders 
        WHERE DATE(created_at) = CURDATE() AND status = 'selesai'
      ) t
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
        IFNULL(SUM(transaksi),0) AS total_transaksi,
        IFNULL(SUM(penjualan),0) AS total_penjualan
      FROM (
        SELECT 1 AS transaksi, total AS penjualan 
        FROM sales 
        WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
        
        UNION ALL
        
        SELECT 1 AS transaksi, total AS penjualan 
        FROM orders 
        WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) AND status = 'selesai'
      ) t
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
    query = `
      SELECT 
        label,
        IFNULL(SUM(penjualan), 0) AS penjualan,
        IFNULL(SUM(profit), 0) AS profit
      FROM (
        SELECT 
          DATE_FORMAT(s.created_at, '%Y-%m-%d') AS label,
          (si.quantity * si.price) AS penjualan,
          (si.quantity * (si.price - si.cost_price)) AS profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        
        UNION ALL
        
        SELECT 
          DATE_FORMAT(o.created_at, '%Y-%m-%d') AS label,
          (oi.quantity * oi.price) AS penjualan,
          (oi.quantity * (oi.price - p.cost_price)) AS profit
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE DATE(o.created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND o.status = 'selesai'
      ) t
      GROUP BY label
      ORDER BY label ASC
    `;
  }

  if (type === 'monthly') {
    query = `
      SELECT
        label,
        IFNULL(SUM(penjualan), 0) AS penjualan,
        IFNULL(SUM(profit), 0) AS profit
      FROM (
        SELECT 
          DATE_FORMAT(s.created_at, '%Y-%m-%d') AS label,
          (si.quantity * si.price) AS penjualan,
          (si.quantity * (si.price - si.cost_price)) AS profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE MONTH(s.created_at) = MONTH(CURDATE()) AND YEAR(s.created_at) = YEAR(CURDATE())
        
        UNION ALL
        
        SELECT 
          DATE_FORMAT(o.created_at, '%Y-%m-%d') AS label,
          (oi.quantity * oi.price) AS penjualan,
          (oi.quantity * (oi.price - p.cost_price)) AS profit
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE MONTH(o.created_at) = MONTH(CURDATE()) AND YEAR(o.created_at) = YEAR(CURDATE()) AND o.status = 'selesai'
      ) t
      GROUP BY label
      ORDER BY label ASC
    `;
  }

  if (type === 'yearly') {
    query = `
      SELECT
        label,
        IFNULL(SUM(penjualan), 0) AS penjualan,
        IFNULL(SUM(profit), 0) AS profit
      FROM (
        SELECT 
          DATE_FORMAT(s.created_at, '%Y-%m') AS label,
          (si.quantity * si.price) AS penjualan,
          (si.quantity * (si.price - si.cost_price)) AS profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE YEAR(s.created_at) = YEAR(CURDATE())
        
        UNION ALL
        
        SELECT 
          DATE_FORMAT(o.created_at, '%Y-%m') AS label,
          (oi.quantity * oi.price) AS penjualan,
          (oi.quantity * (oi.price - p.cost_price)) AS profit
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE YEAR(o.created_at) = YEAR(CURDATE()) AND o.status = 'selesai'
      ) t
      GROUP BY label
      ORDER BY label ASC
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
        IFNULL(SUM(t.penjualan), 0) AS total_penjualan,
        IFNULL(SUM(t.modal), 0) AS total_modal,
        IFNULL(SUM(t.profit), 0) AS total_profit,
        SUM(t.transaksi) AS total_transaksi,
        ROUND(IFNULL(SUM(t.profit) / NULLIF(SUM(t.modal), 0) * 100, 0), 2) AS margin_profit
      FROM (
        SELECT 
          (si.quantity * si.price) AS penjualan,
          (si.quantity * si.cost_price) AS modal,
          (si.quantity * (si.price - si.cost_price)) AS profit,
          COUNT(DISTINCT si.sale_id) AS transaksi
        FROM sale_items si

        UNION ALL

        SELECT 
          (oi.quantity * oi.price) AS penjualan,
          (oi.quantity * p.cost_price) AS modal,
          (oi.quantity * (oi.price - p.cost_price)) AS profit,
          COUNT(DISTINCT oi.order_id) AS transaksi
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE o.status = 'selesai'
      ) t
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error('SUMMARY ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;