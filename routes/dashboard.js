const express = require("express");
const router = express.Router();

const db = require("../db");
const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

/**
 * 📊 RINGKASAN ORDER AKTIF (ADMIN)
 */
router.get("/orders-summary", auth, isAdmin, async (req, res) => {
  console.log("HIT DASHBOARD SUMMARY");
  try {
    const [rows] = await db.query(`
      SELECT status, COUNT(*) AS total
      FROM orders
      WHERE status IN ('diproses','dikirim')
      GROUP BY status
    `);

    const summary = {
      masuk: 0,
      diproses: 0,
      dikirim: 0,
    };

    rows.forEach((r) => {
      summary[r.status] = r.total;
      summary.masuk += r.total;
    });

    res.json(summary);

  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;