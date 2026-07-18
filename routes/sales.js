const express = require("express");
const router = express.Router();

const db = require("../db");
const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const checkLowStock = require("../utils/checkLowStock");

/* ========================================
   BUAT TRANSAKSI KASIR
======================================== */
router.post("/", auth, isAdmin, async (req, res) => {
  const { items } = req.body;

  if (
    !items ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({
      message: "Items tidak valid",
    });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    let total = 0;

    /* ================= VALIDASI ================= */
    for (const item of items) {

      if (
        !item.product_id ||
        !item.quantity ||
        item.quantity <= 0
      ) {
        throw new Error(
          "Data item tidak valid"
        );
      }

      const [rows] = await conn.query(
        `
        SELECT
        id,
        name,
        price,
        stock,
        cost_price
        FROM products
        WHERE id=?
        AND deleted_at IS NULL
        FOR UPDATE
        `,
        [item.product_id]
      );

      if (rows.length === 0) {
        throw new Error(
          "Produk tidak ditemukan"
        );
      }

      const product = rows[0];

      if (
        product.stock <
        item.quantity
      ) {
        throw new Error(
          `${product.name || "Produk"} stok tidak cukup`
        );
      }

      total +=
        product.price *
        item.quantity;
    }

    /* ================= INSERT SALES ================= */

    const [saleResult] =
      await conn.query(
        `
        INSERT INTO sales
        (
          admin_id,
          total
        )
        VALUES (?,?)
      `,
        [req.user.id, total]
      );

    const saleId =
      saleResult.insertId;

    /* ================= INSERT ITEM ================= */

    for (const item of items) {

      const [[product]] =
        await conn.query(
          `
          SELECT
          price,
          cost_price
          FROM products
          WHERE id=?
        `,
          [item.product_id]
        );

      await conn.query(
        `
        INSERT INTO sale_items
        (
          sale_id,
          product_id,
          quantity,
          price,
          cost_price
        )
        VALUES (?,?,?,?,?)
      `,
        [
          saleId,
          item.product_id,
          item.quantity,
          product.price,
          product.cost_price
        ]
      );

      /* kurangi stok */

      await conn.query(
      `
      UPDATE products
      SET stock=stock-?
      WHERE id=?
      `,
      [
      item.quantity,
      item.product_id
      ]
      );
    }

    await conn.commit();

    /* ================= CEK STOK MINIMUM (setelah commit) ================= */

    const io =
    req.app.get("io");

    for (const item of items) {

      await checkLowStock(
      item.product_id,
      io
      );

    }

    res.json({
      success:true,
      message:"Penjualan berhasil",
      saleId,
      total,
      transactionDate:new Date()
    });

  } catch (err) {

    await conn.rollback();

    console.log(
      "SALES ERROR:",
      err
    );

    res.status(400).json({
      success:false,
      message:err.message
    });

  } finally {
    conn.release();
  }
});


/* ================= RIWAYAT PENJUALAN ================= */

router.get(
"/history/all",
auth,
isAdmin,

async(req,res)=>{

try{

/* OFFLINE (KASIR) */

const [sales]=await db.query(`
SELECT
s.id,
'offline' AS type,
u.name AS customer,
s.total,
s.created_at

FROM sales s

LEFT JOIN users u
ON u.id=s.admin_id
`);


/* ONLINE (HANYA SELESAI) */

const [orders]=await db.query(`
SELECT
o.id,
'online' AS type,
u.name AS customer,
o.total,

COALESCE(
o.completed_at,
o.created_at
) AS created_at

FROM orders o

LEFT JOIN users u
ON u.id=o.user_id

WHERE o.status='selesai'
`);


/* GABUNG */

const history=[
...sales,
...orders
];


/* TERBARU KE TERLAMA */

history.sort(
(a,b)=>
new Date(b.created_at)
-
new Date(a.created_at)
);

res.json(history);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

});


/* ================= RIWAYAT SALES ================= */

router.get(
"/",
auth,
isAdmin,
async(req,res)=>{

try{

const [rows]=await db.query(`
SELECT
s.id,
u.name admin,
s.total,
s.created_at
FROM sales s
JOIN users u
ON u.id=s.admin_id
ORDER BY s.created_at DESC
`);

res.json(rows);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

});


/* ================= DETAIL SALES ================= */

router.get(
"/:id",
auth,
isAdmin,
async(req,res)=>{

try{

const saleId=req.params.id;

const [[sale]]=await db.query(`
SELECT *
FROM sales
WHERE id=?
`,[saleId]);

if(!sale){

return res.status(404)
.json({
message:"Transaksi tidak ditemukan"
});

}

const [items]=await db.query(`
SELECT
si.*,
p.name,
p.image
FROM sale_items si
JOIN products p
ON p.id=si.product_id
WHERE sale_id=?
`,[saleId]);

res.json({
sale,
items
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

});

module.exports=router;