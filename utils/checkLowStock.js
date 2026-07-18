const db = require("../db");
const { createNotification } =
require("./notification");

const checkLowStock = async (
  productId,
  io = null
) => {

  const [[product]] =
  await db.query(
  `
  SELECT id,name,stock
  FROM products
  WHERE id=?
  `,
  [productId]
  );

  if(!product) return;

  if(product.stock > 5){
    return;
  }

  const [admins] =
  await db.query(
  `
  SELECT id
  FROM users
  WHERE role='admin'
  `
  );

  for(const adm of admins){

    const [exist] =
    await db.query(
    `
    SELECT id
    FROM notifications
    WHERE user_id=?
    AND type='stock'
    AND title='Stok Hampir Habis'
    AND message=?
    LIMIT 1
    `,
    [
      adm.id,
      `${product.name} tinggal ${product.stock}`
    ]
    );

    if(exist.length===0){

      await createNotification({
        user_id: adm.id,
        type: "stock",
        title: "Stok Hampir Habis",
        message:
        `${product.name} tinggal ${product.stock}`
      });

      console.log(
        "NOTIF STOK:",
        product.name,
        product.stock
      );

    }

  }

  if(io){

    io.emit(
      "stock_alert",
      {
        product: product.name,
        stock: product.stock
      }
    );

  }

};

module.exports = checkLowStock;