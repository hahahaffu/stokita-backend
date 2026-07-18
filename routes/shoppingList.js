const express = require("express");
const router = express.Router();

const db = require("../db");

const auth = require("../middleware/auth");

router.get("/", auth, async (req, res) => {

  try {

    const [rows] = await db.query(`
      SELECT
        sl.id,
        sl.quantity,

        p.id AS product_id,
        p.name,
        p.price,
        p.stock,
        p.image

      FROM shopping_list sl

      JOIN products p
      ON p.id = sl.product_id

      WHERE sl.user_id = ?

      ORDER BY
      sl.created_at DESC
    `,
    [req.user.id]);

    res.json(rows);

  } catch(err){

    console.log(err);

    res.status(500).json({
      message:"Server error"
    });

  }

});

router.post("/", auth, async(req,res)=>{

try{

const{

product_id,
quantity=1

}=req.body;

const[[exist]]=await db.query(

`
SELECT
id,
quantity
FROM shopping_list
WHERE
user_id=?
AND product_id=?
`,
[
req.user.id,
product_id
]

);

if(exist){

await db.query(

`
UPDATE shopping_list
SET quantity=quantity+?
WHERE id=?
`,
[
quantity,
exist.id
]

);

return res.json({
message:"Jumlah produk diperbarui"
});

}

await db.query(

`
INSERT INTO shopping_list
(
user_id,
product_id,
quantity
)

VALUES(?,?,?)
`,
[
req.user.id,
product_id,
quantity
]

);

res.json({
message:"Produk ditambahkan"
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

});

router.put("/:id",auth,async(req,res)=>{

try{

const{
quantity
}=req.body;

await db.query(

`
UPDATE shopping_list

SET quantity=?

WHERE

id=?
AND user_id=?
`,
[
quantity,
req.params.id,
req.user.id
]

);

res.json({
message:"Berhasil"
});

}catch(err){

res.status(500).json({
message:"Server error"
});

}

});

router.delete("/:id",auth,async(req,res)=>{

try{

await db.query(

`
DELETE FROM shopping_list

WHERE
id=?
AND user_id=?
`,
[
req.params.id,
req.user.id
]

);

res.json({
message:"Produk dihapus"
});

}catch(err){

res.status(500).json({
message:"Server error"
});

}

});

router.post("/add-all-to-cart", auth, async (req, res) => {

  const conn = await db.getConnection();

  try {

    await conn.beginTransaction();

    const userId = req.user.id;

    const [shoppingList] = await conn.query(`
      SELECT
        sl.product_id,
        sl.quantity,

        p.name,
        p.stock

      FROM shopping_list sl

      JOIN products p
      ON p.id = sl.product_id

      WHERE sl.user_id=?
    `,[userId]);

    if(shoppingList.length===0){

      return res.status(400).json({
        success:false,
        message:"Daftar belanja masih kosong."
      });

    }

    const addedProducts=[];
    const unavailableProducts=[];

    for(const item of shoppingList){

      /* stok tidak cukup */

      if(item.stock < item.quantity){

        unavailableProducts.push({

          product_id:item.product_id,
          name:item.name,
          requested:item.quantity,
          stock:item.stock,
          reason:
          `Stok tersedia hanya ${item.stock}`

        });

        continue;

      }

      /* cek apakah sudah ada di cart */

      const [[cart]]=await conn.query(`
        SELECT
        id,
        quantity

        FROM cart

        WHERE
        user_id=?
        AND product_id=?
      `,
      [
        userId,
        item.product_id
      ]);

      if(cart){

        await conn.query(`
          UPDATE cart

          SET quantity=quantity+?

          WHERE id=?
        `,
        [
          item.quantity,
          cart.id
        ]);

      }else{

        await conn.query(`
          INSERT INTO cart
          (
            user_id,
            product_id,
            quantity
          )
          VALUES(?,?,?)
        `,
        [
          userId,
          item.product_id,
          item.quantity
        ]);

      }

      addedProducts.push({

        product_id:item.product_id,
        name:item.name,
        quantity:item.quantity

      });

    }

    await conn.commit();

    res.json({

      success:true,

      message:"Shopping List berhasil diproses.",

      summary:{

        total_item:
        shoppingList.length,

        berhasil:
        addedProducts.length,

        gagal:
        unavailableProducts.length

      },

      added:addedProducts,

      unavailable:unavailableProducts

    });

  }catch(err){

    await conn.rollback();

    console.log(err);

    res.status(500).json({

      success:false,

      message:"Server error"

    });

  }finally{

    conn.release();

  }

});

module.exports = router;