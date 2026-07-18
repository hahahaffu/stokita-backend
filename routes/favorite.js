const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");

/* ================= GET FAVORITES ================= */
router.get("/", authMiddleware, async (req, res) => {
  try {
  const [rows] = await db.query(`
    SELECT 
      products.*, 
      categories.name AS category_name
    FROM favorites f
    JOIN products ON products.id = f.product_id
    LEFT JOIN categories ON categories.id = products.category_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `, [req.user.id]);

    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

/* ================= CHECK FAVORITE ================= */
router.get("/check/:id", authMiddleware, async (req, res) => {
  const productId = req.params.id;

  const [rows] = await db.query(
    "SELECT * FROM favorites WHERE user_id=? AND product_id=?",
    [req.user.id, productId]
  );

  res.json({ isFavorite: rows.length > 0 });
});


router.delete("/:productId", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;

    await db.query(
      "DELETE FROM favorites WHERE user_id = ? AND product_id = ?",
      [req.user.id, productId]
    );

    res.json({ message: "Removed from favorite" });
  } catch (err) {
    res.status(500).json(err);
  }
});

router.post("/toggle/:productId", authMiddleware, async (req, res) => {
  const { productId } = req.params;

  const [rows] = await db.query(
    "SELECT * FROM favorites WHERE user_id=? AND product_id=?",
    [req.user.id, productId]
  );

  if (rows.length > 0) {
    await db.query(
      "DELETE FROM favorites WHERE user_id=? AND product_id=?",
      [req.user.id, productId]
    );
    return res.json({ message: "removed" });
  }

  await db.query(
    "INSERT INTO favorites (user_id, product_id) VALUES (?, ?)",
    [req.user.id, productId]
  );

  res.json({ message: "added" });
});

module.exports = router;