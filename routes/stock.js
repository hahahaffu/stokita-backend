const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const { createNotification } = require("../utils/notification");
const checkLowStock = require("../utils/checkLowStock");
const auditLog = require("../utils/auditLog");

/* ===== SCAN BARCODE ===== */
router.get("/scan/:barcode", auth, async (req, res) => {
  try {
    let { barcode } = req.params;

    /* ================= CLEAN BARCODE ================= */
    barcode = String(barcode)
      .trim()
      .replace(/\s/g, "");

    /* ================= VALIDASI ================= */
    if (!barcode || barcode.length < 6) {
      return res.status(400).json({
        message: "Barcode tidak valid",
      });
    }

    /* ================= SEARCH PRODUCT ================= */
    const [rows] = await db.query(
      `
      SELECT 
        id,
        name,
        barcode,
        stock,
        cost_price
      FROM products
      WHERE barcode = ?
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [barcode]
    );

    /* ================= NOT FOUND ================= */
    if (rows.length === 0) {
      return res.status(404).json({
        message: "Produk tidak ditemukan",
      });
    }

    /* ================= SUCCESS ================= */
    return res.json(rows[0]);

  } catch (err) {
    console.error("SCAN ERROR:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

/* ===== STOK MASUK ===== */
router.post("/in", auth, isAdmin, async (req, res) => {
  let { product_id, quantity, price } = req.body;

  quantity = Number(quantity);
  price = Number(price);

  if (!product_id || quantity <= 0) {
    return res.status(400).json({ message: "Data tidak valid" });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* ===== CEK PRODUK ===== */
    const [[product]] = await conn.query(
      `SELECT id, name, stock, cost_price 
       FROM products 
       WHERE id=? AND deleted_at IS NULL FOR UPDATE`,
      [product_id]
    );

    if (!product) throw new Error("Produk tidak ditemukan");

    /* ===== HITUNG COST PRICE ===== */
    let newCostPrice = product.cost_price;

    if (price > 0) {
      const totalNilaiLama = product.stock * product.cost_price;
      const totalNilaiBaru = quantity * price;
      const totalStockBaru = product.stock + quantity;

      newCostPrice =
        totalStockBaru === 0
          ? price
          : (totalNilaiLama + totalNilaiBaru) / totalStockBaru;
    }

    const newStock = product.stock + quantity;

    /* ===== INSERT STOCK ===== */
    await conn.query(
      "INSERT INTO stock_in (product_id, quantity, price) VALUES (?, ?, ?)",
      [product_id, quantity, price || 0]
    );

    /* ===== UPDATE PRODUCT ===== */
    await conn.query(
      "UPDATE products SET stock=?, cost_price=? WHERE id=?",
      [newStock, newCostPrice, product_id]
    );

    await conn.commit();

    await auditLog({
      user_id: req.user.id,
      action: `STOCK_IN +${quantity}`,
      table: "products",
      role: req.user.role,
      record_id: product_id
    });

    res.json({
      message: "Stok berhasil ditambahkan",
      cost_price: newCostPrice,
      stock: newStock,
    });

  } catch (err) {
    await conn.rollback();
    console.error("STOCK ERROR:", err);
    res.status(400).json({ message: err.message });
  } finally {
    conn.release();
  }
});

router.post(
"/import-receipt",
auth,
async(req,res)=>{

const {items}=req.body;

const conn=
await db.getConnection();

try{

await conn.beginTransaction();

for(
const item of items
){

const [rows]=
await conn.query(

`SELECT id,stock
FROM products
WHERE name LIKE ?`,

[`%${item.name}%`]

)

if(rows.length){

await conn.query(

`UPDATE products
SET stock=stock+?
WHERE id=?`,

[
item.qty,
rows[0].id
]

)

}

}

await conn.commit();

res.json({
message:
"Import berhasil"
})

}
catch(err){

await conn.rollback();

res.status(500).json({
message:"error"
})

}
finally{

conn.release()

}

})

module.exports = router;