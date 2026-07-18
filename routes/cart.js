    const express=require("express");
    const router=express.Router();

    const db=require("../db");
    const authMiddleware=require("../middleware/auth");


    /* ================= TAMBAH KERANJANG ================= */

    router.post(
    "/",
    authMiddleware,

    async(req,res)=>{

    try{

    const userId=req.user.id;

    const {
    product_id,
    quantity
    }=req.body;


    /* cek sudah ada belum */

    const [exist]=await db.query(
    `
    SELECT *
    FROM cart
    WHERE user_id=?
    AND product_id=?
    `,
    [userId,product_id]
    );


    if(exist.length>0){

    await db.query(
    `
    UPDATE cart
    SET quantity=
    quantity+?
    WHERE user_id=?
    AND product_id=?
    `,
    [
    quantity,
    userId,
    product_id
    ]
    );

    }else{

    await db.query(
    `
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
    product_id,
    quantity
    ]
    );

    }


    res.json({

    message:
    "Berhasil tambah keranjang"

    });


    }catch(err){

    console.log(err);

    res.status(500).json({

    message:
    "Gagal tambah keranjang"

    });

    }

    });



    /* ================= GET CART ================= */

    router.get(
    "/",
    authMiddleware,

    async(req,res)=>{

    try{

    const userId=req.user.id;

    console.log("USER LOGIN:",userId);

    const [rows]=await db.query(
    `
    SELECT

    cart.id,
    cart.quantity,

    products.id as product_id,
    products.name,
    products.price,
    products.image,
    products.stock

    FROM cart

    JOIN products
    ON products.id=
    cart.product_id

    WHERE cart.user_id=?

    ORDER BY cart.id DESC
    `,
    [userId]
    );

    console.log("DATA CART:",rows);

    res.json(rows);

    }catch(err){

    console.log(err);

    res.status(500).json({
    message:"Gagal ambil keranjang"
    });

    }

    });



    /* ================= UPDATE QTY ================= */

    router.put(
    "/:id",
    authMiddleware,

    async(req,res)=>{

    try{

    const {id}=req.params;

    const {
    quantity
    }=req.body;


    await db.query(
    `
    UPDATE cart
    SET quantity=?
    WHERE id=?
    `,
    [
    quantity,
    id
    ]
    );


    res.json({
    message:
    "Berhasil update"
    });

    }catch(err){

    console.log(err);

    res.status(500).json({
    message:
    "Gagal update"
    });

    }

    });



    /* ================= HAPUS ITEM ================= */

    router.delete(
    "/:id",
    authMiddleware,

    async(req,res)=>{

    try{

    const {id}=req.params;

    await db.query(
    `
    DELETE FROM cart
    WHERE id=?
    `,
    [id]
    );


    res.json({

    message:
    "Berhasil dihapus"

    });

    }catch(err){

    console.log(err);

    res.status(500).json({
    message:
    "Gagal hapus"
    });

    }

    });



    module.exports=router;