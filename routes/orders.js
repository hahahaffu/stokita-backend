const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const admin = require("../utils/firebase");
const { createNotification } = require("../utils/notification");
const checkLowStock = require("../utils/checkLowStock");
const auditLog = require("../utils/auditLog");

/* =====================================================
   🛒 PELANGGAN MEMBUAT PESANAN
===================================================== */

router.post(
"/checkout",
auth,

async(req,res)=>{

const conn = await db.getConnection();

try{

await conn.beginTransaction();

const userId = req.user.id;
const { note, address_id } = req.body;

/* ================= AMBIL ALAMAT ================= */
let addressData = null;

if (address_id) {
  const [addrRows] = await conn.query(
    `SELECT * FROM user_addresses WHERE id=? AND user_id=?`,
    [address_id, userId]
  );
  if (addrRows.length > 0) {
    addressData = addrRows[0];
  }
}

if (!addressData) {
  const [primaryRows] = await conn.query(
    `SELECT * FROM user_addresses WHERE user_id=? ORDER BY is_primary DESC LIMIT 1`,
    [userId]
  );
  if (primaryRows.length > 0) {
    addressData = primaryRows[0];
  }
}

if (!addressData) {
  await conn.rollback();
  return res.status(400).json({
    message: "Silakan pilih atau tambahkan alamat pengiriman terlebih dahulu"
  });
}


/* ================= AMBIL CART ================= */

const [cart] = await conn.query(
`
SELECT
cart.*,
products.name,
products.price,
products.cost_price,
products.stock

FROM cart

JOIN products
ON products.id = cart.product_id

WHERE cart.user_id=?
FOR UPDATE
`,
[userId]
);

if(cart.length===0){

await conn.rollback();

return res.status(400).json({
message:"Keranjang kosong"
});

}


/* ================= HITUNG TOTAL ================= */

let subtotal = 0;

for(const item of cart){

if(item.stock < item.quantity){

throw new Error(
`Stok ${item.name} tidak cukup`
);

}

subtotal +=
item.price * item.quantity;

}

const shippingCost = 2000;

const total =
subtotal + shippingCost;


/* ================= SIMPAN ORDER ================= */

const [orderResult] =
await conn.query(
`
INSERT INTO orders
(
user_id,
total,
shipping_cost,
status,
note,
receiver_name,
receiver_phone,
delivery_address,
delivery_latitude,
delivery_longitude
)
VALUES(?,?,?,?,?,?,?,?,?,?)
`,
[
userId,
total,
shippingCost,
"diproses",
note || null,
addressData.receiver_name,
addressData.phone,
addressData.address,
addressData.latitude,
addressData.longitude
]
);

const orderId =
orderResult.insertId;


/* ================= SIMPAN DETAIL & KURANGI STOK ================= */

for(const item of cart){

await conn.query(
`
INSERT INTO order_items
(
order_id,
product_id,
quantity,
price,
cost_price
)
VALUES(?,?,?,?,?)
`,
[
orderId,
item.product_id,
item.quantity,
item.price,
item.cost_price
]
);

await conn.query(
`
UPDATE products
SET stock = stock - ?
WHERE id = ?
`,
[
item.quantity,
item.product_id
]
);

}

/* ================= NOTIF ADMIN ================= */

const [admins] =
await conn.query(
`
SELECT id
FROM users
WHERE role='admin'
`
);

for(const adminUser of admins){

await createNotification({

user_id:adminUser.id,

type:"order",

title:"Pesanan Baru",

message:`Pesanan #${orderId} masuk`

});

}


/* ================= KOSONGKAN CART ================= */

await conn.query(
`
DELETE FROM cart
WHERE user_id=?
`,
[userId]
);


await conn.commit();


/* ================= REALTIME: PESANAN BARU ================= */

const io = req.app.get("io");

if(io){

io.emit("new_order", {
orderId,
userId
});

}


/* ================= CEK STOK MINIMUM (setelah commit) ================= */

for(const item of cart){

await checkLowStock(
item.product_id,
io
);

}


/* ================= RESPONSE ================= */

await auditLog({
user_id: userId,
action: 'CREATE_ORDER',
table: 'orders',
role: req.user.role,
record_id: orderId
});

res.status(201).json({

success:true,

message:"Checkout berhasil",

order_id:orderId,          // NEW

subtotal,                  // NEW

shipping_cost:shippingCost,// NEW

total                      // NEW

});

}catch(err){

await conn.rollback();

console.log(err);

res.status(500).json({

success:false,

message:err.message

});

}finally{

conn.release();

}

});


/* =====================================================
   📦 PESANAN SAYA
===================================================== */
router.get("/my", auth, async (req, res) => {
  if (req.user.role !== "pelanggan") {
    return res.status(403).json({ message: "Hanya pelanggan" });
  }

try {

    const [rows] = await db.query(
      `
      SELECT
      id,
      total,
      status,
      note,
      created_at
      FROM orders
      WHERE user_id=?
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= RIWAYAT PESANAN ================= */

router.get(
"/history",
auth,

async(req,res)=>{

try{

const [rows]=await db.query(
`
SELECT
id,
total,
status,
note,
completed_at

FROM orders

WHERE user_id=?
AND status='selesai'

ORDER BY completed_at DESC
`,
[req.user.id]
);

res.json(rows);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

});


/* =====================================================
   📋 ADMIN LIHAT SEMUA PESANAN
===================================================== */
router.get("/", auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id,
        receiver_name AS pelanggan,
        delivery_address AS alamat,
        total,
        status,
        created_at
      FROM orders
      ORDER BY created_at DESC
    `);

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


/* =====================================================
   🔄 UPDATE STATUS
===================================================== */
router.put("/:id/status", auth, isAdmin, async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  const allowedStatus = ["diproses", "dikirim", "selesai", "batal"];
  if (!allowedStatus.includes(status)) {
    return res.status(400).json({ message: "Status tidak valid" });
  }

  const conn = await db.getConnection();
  let restockedItems = [];

  try {
    await conn.beginTransaction();

    const [[order]] = await conn.query(
      "SELECT * FROM orders WHERE id=?",
      [orderId]
    );

    if (!order) throw new Error("Order tidak ditemukan");

    if(order.status===status){

    throw new Error(
    "Status pesanan sudah sama."
    );

    }

    if ((order.status === "dikirim" || order.status === "selesai") && status === "diproses") {
      throw new Error("Pesanan yang sudah dikirim tidak dapat diubah kembali menjadi diproses.");
    }

    if (status === "dikirim" || status === "selesai") {
      const [items] = await conn.query(
        "SELECT is_checked FROM order_items WHERE order_id=?",
        [orderId]
      );
      const allChecked = items.every((item) => item.is_checked === 1);
      if (!allChecked) {
        throw new Error("Anda harus men-checklist semua item terlebih dahulu.");
      }
    }

    if(
    order.status==="batal"
    ){

    throw new Error(
    "Pesanan sudah dibatalkan."
    );

    }

    if(status==="selesai"){

    await conn.query(
    `
    UPDATE orders
    SET
    status=?,
    completed_at=NOW()
    WHERE id=?
    `,
    [
    status,
    orderId
    ]
    );

    }

    else if(status==="batal"){

    await conn.query(
    `
    UPDATE orders
    SET
    status=?
    WHERE id=?
    `,
    [
    status,
    orderId
    ]);

    const [items]=await conn.query(
    `
    SELECT
    product_id,
    quantity
    FROM order_items
    WHERE order_id=?
    `,
    [
    orderId
    ]);

    for(const item of items){

    await conn.query(
    `
    UPDATE products
    SET stock = stock + ?
    WHERE id = ?
    `,
    [
    item.quantity,
    item.product_id
    ]);

    }

    restockedItems = items;

    }

    else{

    await conn.query(
    `
    UPDATE orders
    SET status=?
    WHERE id=?
    `,
    [
    status,
    orderId
    ]
    );

    }

    await conn.commit();

    /* ================= CEK STOK MINIMUM (setelah commit) ================= */

    const io=req.app.get("io");

    for(const item of restockedItems){

    await checkLowStock(
    item.product_id,
    io
    );

    }

    /* ================= NOTIF KE USER ================= */

    await createNotification({

    user_id:order.user_id,

    type:"order",

    order_id:order.id,

    title:
    status==="batal"
    ?
    "Pesanan Dibatalkan"
    :
    "Update Pesanan",

    message:
    status==="batal"
    ?
    `Pesanan #${order.id} dibatalkan. Stok telah dikembalikan.`
    :
    `Status pesanan #${order.id} menjadi ${status}.`

    });

    /* ================= TRANSAKSI SELESAI ================= */

    if(status==="selesai"){

    await createNotification({
      user_id:order.user_id,
      type:"transaction",

      order_id:order.id,
      total:order.total,

      title:"Transaksi Berhasil",

      message:
      `Pesanan #${order.id} telah dibayar`
    });

      if(io){

        io.emit(
          "new_transaction",
          {
            orderId:order.id,
            userId:order.user_id
          }
        );

      }

    }

    /* ================= PUSH ================= */
    const [[user]] = await db.query(
      "SELECT fcm_token FROM users WHERE id=?",
      [order.user_id]
    );

    if (user?.fcm_token) {
      try {
        await admin.messaging().send({
          notification: {
            title: "Update Pesanan",
            body: `Status pesanan kamu: ${status}`,
          },
          token: user.fcm_token,
        });
      } catch (err) {
        console.log("FCM ERROR:", err.message);
      }
    }

    await auditLog({
      user_id: req.user.id,
      action: `UPDATE_STATUS ${order.status} → ${status}`,
      table: "orders",
      role: req.user.role,
      record_id: orderId
    });

    res.json({ message: "Status berhasil diupdate" });

  } catch (err) {
    await conn.rollback();
    res.status(400).json({ message: err.message });
  } finally {
    conn.release();
  }
});


/* =====================================================
   📄 DETAIL PESANAN
===================================================== */
router.get('/:id(\\d+)', auth, async (req, res) => {
  const orderId = req.params.id;

  try {
    const [orders] = await db.query(
      `SELECT 
        id,
        user_id,
        total,
        shipping_cost,
        status,
        note,
        created_at,
        completed_at,
        receiver_name AS pelanggan,
        receiver_phone AS phone,
        delivery_address AS alamat
       FROM orders
       WHERE id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order tidak ditemukan' });
    }

    const order = orders[0];

    const [items] = await db.query(
      `SELECT 
        oi.id AS item_id,
        oi.product_id,
        oi.is_checked,
        p.name AS product_name,
        p.image,
        oi.quantity,
        oi.price,
        (oi.quantity * oi.price) AS subtotal
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    res.json({
      order,
      items
    });

  } catch (err) {
    console.error('DETAIL ORDER ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


/* =====================================================
   ✅ CHECKLIST ITEM (ADMIN ONLY)
===================================================== */
router.put('/:orderId/items/:itemId/check', auth, isAdmin, async (req, res) => {
  const { orderId, itemId } = req.params;
  const { is_checked } = req.body;

  try {
    await db.query(
      `UPDATE order_items SET is_checked = ? WHERE id = ? AND order_id = ?`,
      [is_checked ? 1 : 0, itemId, orderId]
    );
    res.json({ message: "Status checklist diupdate" });
  } catch (err) {
    console.error('CHECKLIST ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;