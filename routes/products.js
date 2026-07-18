const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const auditLog = require('../utils/auditLog');
const upload = require('../middleware/upload');

/* ================= GET ALL ================= */
router.get('/', async (req, res) => {
  const { search, category } = req.query;

  let query = `
    SELECT * FROM products 
    WHERE deleted_at IS NULL
  `;

  const params = [];

  if (search) {
    query += ` AND name LIKE ?`;
    params.push(`%${search}%`);
  }

  if (category) {
    query += ` AND category_id = ?`;
    params.push(category);
  }

  try {
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET PRODUCTS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ================= CREATE ================= */
router.post(
'/',
auth,
isAdmin,
upload.single('image'),

async(req,res)=>{

const {
name,
category_id,
barcode,
price,
}=req.body;

if(!name || !category_id){
return res.status(400).json({
message:'Data tidak lengkap'
});
}

try{

// 🔥 CEK BARCODE SUDAH DIPAKAI PRODUK LAIN
if(barcode){

const [existing]=await db.query(
`
SELECT id FROM products
WHERE barcode=?
AND deleted_at IS NULL
LIMIT 1
`,
[barcode]
);

if(existing.length>0){
return res.status(409).json({
message:'Barcode sudah digunakan oleh produk lain'
});
}

}

const imageUrl=
req.file?.path || null;

const [result]=await db.query(
`
INSERT INTO products
(
name,
category_id,
barcode,
price,
image
)
VALUES(?,?,?,?,?)
`,
[
name,
category_id,
barcode || null,
price || 0,
imageUrl,
]
);

await auditLog({
user_id:req.user.id,
action:'CREATE',
table:'products',
role:req.user.role,
record_id:result.insertId
});

res.json({
message:'Produk berhasil ditambahkan',
id:result.insertId,
image:imageUrl
});

}catch(err){

console.error(
'CREATE PRODUCT ERROR:',
err
);

res.status(500).json({
message:'Server error'
});

}
});

/* ================= UPDATE ================= */
router.put(
"/:id",
auth,
isAdmin,
upload.single("image"),
async(req,res)=>{

try{

const id=req.params.id;

const {
barcode,
name,
category_id,
price
}=req.body;

// 🔥 CEK BARCODE SUDAH DIPAKAI PRODUK LAIN (selain produk ini sendiri)
if(barcode){

const [existing]=await db.query(
`
SELECT id FROM products
WHERE barcode=?
AND deleted_at IS NULL
AND id!=?
LIMIT 1
`,
[barcode, id]
);

if(existing.length>0){
return res.status(409).json({
message:'Barcode sudah digunakan oleh produk lain'
});
}

}

let image=null;

if(req.file){

image=req.file.path;

}

if(image){

await db.query(
`
UPDATE products
SET
barcode=?,
name=?,
category_id=?,
price=?,
image=?
WHERE id=?
`,
[
barcode,
name,
category_id,
price,
image,
id
]
);

}else{

await db.query(
`
UPDATE products
SET
barcode=?,
name=?,
category_id=?,
price=?
WHERE id=?
`,
[
barcode,
name,
category_id,
price,
id
]
);

}

await auditLog({
user_id:req.user.id,
action:'UPDATE',
table:'products',
role:req.user.role,
record_id:id
});

res.json({
message:"Produk berhasil diperbarui"
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

});

/* ================= DELETE (SOFT DELETE) ================= */
router.delete('/:id', auth, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      'UPDATE products SET deleted_at = NOW() WHERE id = ?',
      [id]
    );

    await auditLog({
      user_id: req.user.id,
      action: 'DELETE',
      table: 'products',
      role: req.user.role,
      record_id: id
    });

    res.json({ message: 'Produk dihapus' });

  } catch (err) {
    console.error('DELETE PRODUCT ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ================= GET PRODUCT BY BARCODE ================= */
router.get("/barcode/:code", auth, async (req, res) => {
  try {
    let { code } = req.params;

    // ================= CLEAN BARCODE =================
    code = String(code)
      .trim()
      .replace(/\s/g, "");

    // 🔥 validasi minimal
    if (!code || code.length < 6) {
      return res.status(400).json({
        message: "Barcode tidak valid",
      });
    }

    // ================= SEARCH PRODUCT =================
    const [rows] = await db.query(
      `
      SELECT 
        id,
        name,
        barcode,
        price,
        stock,
        image,
        category_id
      FROM products
      WHERE barcode = ?
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [code]
    );

    // ================= NOT FOUND =================
    if (rows.length === 0) {
      return res.status(404).json({
        message: "Produk tidak ditemukan",
      });
    }

    // ================= SUCCESS =================
    return res.json(rows[0]);

  } catch (err) {
    console.error(
      "GET PRODUCT BY BARCODE ERROR:",
      err
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;